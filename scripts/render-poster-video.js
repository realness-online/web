import { spawn, fork } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const __filename = fileURLToPath(import.meta.url)
const project_root = path.join(__dirname, '..')
const out_dir = path.join(project_root, 'artifacts', 'poster-video')

// Render against the deployed site so a render never depends on a local build,
// prerender, or wasm step being present and current. Override for a preview
// (e.g. REALNESS_URL=https://realness.local).
const base_url = process.env.REALNESS_URL || 'https://realness.online'
const DRIVER_ROUTE = '/poster-driver'
const READY_TIMEOUT_MS = 120000
const POLL_MS = 1000
const RENDER_RETRIES = 3
const BROWSER_TIMEOUT_MS = 20000
const BROWSER_POLL_MS = 200
const DEBUG_PORT = 9335
const DEFAULT_FPS = 24
const DEFAULT_WORKERS = 6
const ERR_TAIL_LINES = 4
const PROFILE_RM_RETRIES = 5
const PROFILE_RM_DELAY_MS = 200
const SIGINT_EXIT = 130
const SIGTERM_EXIT = 143

const BROWSER_CANDIDATES = [
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(fs.existsSync)

const chrome_path =
  (process.env.CHROME_PATH &&
    fs.existsSync(process.env.CHROME_PATH) &&
    process.env.CHROME_PATH) ||
  BROWSER_CANDIDATES[0]

const fail = message => {
  console.error(`poster-video: ${message}`)
  process.exit(1)
}

// ---- CLI ----
const [, , arg_one, arg_two, arg_three, arg_four] = process.argv
const WORKER_FLAG = '--worker'
let worker_opts = null
let input_path = null
let fps = DEFAULT_FPS
let workers = DEFAULT_WORKERS

if (arg_one === WORKER_FLAG) worker_opts = JSON.parse(arg_two)
else {
  input_path = arg_one
  const rest = [arg_two, arg_three, arg_four]
  for (let index = 0; index < rest.length; index++) {
    const token = rest[index] ?? ''
    if (token === '--fps') fps = Number(rest[index + 1]) || DEFAULT_FPS
    if (token === '--workers') {
      const n = Number(rest[index + 1])
      if (Number.isInteger(n) && n > 0) workers = n
    }
  }
  if (!input_path)
    fail('usage: npm run poster:video <video> [--fps N] [--workers N]')
  if (!chrome_path)
    fail(
      'no Chromium browser found - set CHROME_PATH (Brave, Chrome, Chromium, or Edge)'
    )
  if (!fs.existsSync(input_path)) fail(`video not found: ${input_path}`)
}

const exec = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    let stderr = ''
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('close', code => {
      if (code === 0) resolve()
      else
        reject(new Error(stderr.split('\n').slice(-ERR_TAIL_LINES).join('\n')))
    })
  })

const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

const page_socket_url = async debug_port => {
  const deadline = Date.now() + BROWSER_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debug_port}/json/list`)
      const targets = await response.json()
      const page = targets.find(
        target => target.type === 'page' && target.webSocketDebuggerUrl
      )
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // browser is still coming up
    }
    await sleep(BROWSER_POLL_MS)
  }
  throw new Error('browser never exposed a page target')
}

const connect = socket_url =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(socket_url)
    socket.onopen = () => resolve(socket)
    socket.onerror = () => reject(new Error('devtools socket failed'))
  })

const devtools = socket => {
  let next_id = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data))
    if (message.id !== undefined && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
      return
    }
    if (message.method === 'Runtime.exceptionThrown')
      console.error(
        'poster-video: page error',
        message.params?.exceptionDetails?.exception?.description ??
          message.params?.exceptionDetails?.text
      )
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next_id
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          'evaluate failed'
      )
    return result.result?.value
  }
  return { send, evaluate }
}

const data_url_of = file => {
  const ext = path.extname(file).slice(1) || 'png'
  return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`
}

const status = message => console.info(`poster-video: ${message}`)

// ---- Worker: one headless browser, renders a slice of frames ----
const run_worker = async opts => {
  const {
    source_dir,
    poster_dir,
    start,
    end,
    debug_port,
    worker_id
  } = opts
  const profile_dir = mkdtempSync(path.join(tmpdir(), 'poster-video-prof-'))
  const target_url = `${base_url}${DRIVER_ROUTE}`
  const browser = spawn(
    chrome_path,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${debug_port}`,
      `--user-data-dir=${profile_dir}`,
      target_url
    ],
    { stdio: 'ignore' }
  )
  const shutdown = () => {
    browser.kill()
    try {
      rmSync(profile_dir, {
        recursive: true,
        force: true,
        maxRetries: PROFILE_RM_RETRIES,
        retryDelay: PROFILE_RM_DELAY_MS
      })
    } catch {
      console.warn(`poster-video: left profile dir behind at ${profile_dir}`)
    }
  }
  // Close cleanly on signal so the headless browser is never orphaned holding
  // its debug port.
  for (const sig of ['SIGINT', 'SIGTERM'])
    process.once(sig, () => {
      shutdown()
      process.exit(sig === 'SIGINT' ? SIGINT_EXIT : SIGTERM_EXIT)
    })

  const frame_files = fs
    .readdirSync(source_dir)
    .filter(name => name.endsWith('.png'))
    .sort()

  try {
    const socket = await connect(await page_socket_url(debug_port))
    const { send, evaluate } = devtools(socket)
    await send('Runtime.enable')
    const ready_deadline = Date.now() + READY_TIMEOUT_MS
    let ready = false
    while (Date.now() < ready_deadline) {
      if (await evaluate('window.__poster_driver?.ready === true')) {
        ready = true
        break
      }
      await sleep(POLL_MS)
    }
    if (!ready) throw new Error('poster driver never became ready')

    for (let index = start; index < end; index++) {
      const frame_stem = `poster-${String(index + 1).padStart(5, '0')}`
      const out_png = path.join(poster_dir, `${frame_stem}.png`)
      // Resume: a frame already rendered is left untouched, so an interrupted
      // batch only redoes the missing frames.
      if (fs.existsSync(out_png)) {
        status(`skipping ${frame_stem} (already rendered)`)
        continue
      }
      const frame = frame_files[index]
      const data_url = data_url_of(path.join(source_dir, frame))
      status(
        `rendering ${index + 1}/${frame_files.length} (worker ${worker_id})`
      )

      let result = null
      for (let attempt = 1; attempt <= RENDER_RETRIES && !result; attempt++)
        try {
          result = await evaluate(
            `window.__poster_driver.render(${JSON.stringify(data_url)}).then(r => JSON.stringify({ png: r.png, svg: r.svg }))`
          )
        } catch (error) {
          status(
            `frame ${index + 1} attempt ${attempt} failed: ${error.message}`
          )
        }

      if (!result) throw new Error(`frame ${index + 1} failed after retries`)
      const { png, svg } = JSON.parse(result)
      if (!png) throw new Error(`frame ${index + 1} produced no poster png`)
      const [, base64] = png.split(',')
      fs.writeFileSync(out_png, Buffer.from(base64, 'base64'))
      fs.writeFileSync(path.join(poster_dir, `${frame_stem}.svg`), svg)
    }
  } finally {
    shutdown()
  }
}

// ---- Master: extract, fork workers, encode ----
const run_master = async () => {
  const phase_time = {}
  const t0 = Date.now()
  const mark = name => {
    phase_time[name] = Date.now()
  }

  const tmp = mkdtempSync(path.join(tmpdir(), 'poster-video-'))
  const source_dir = path.join(tmp, 'source')
  // Keep the per-frame poster PNGs next to the output so each can be reviewed
  const stem = path.basename(input_path, path.extname(input_path))
  const poster_dir = path.join(out_dir, `${stem}-frames`)
  fs.mkdirSync(source_dir, { recursive: true })
  // Do NOT wipe poster_dir - already-rendered frames are skipped on resume,
  // so an interrupted run only redoes the missing frames.
  fs.mkdirSync(poster_dir, { recursive: true })
  const existing = fs
    .readdirSync(poster_dir)
    .filter(name => name.endsWith('.png')).length
  if (existing > 0)
    console.info(
      `poster-video: resuming - ${existing} frame(s) already rendered will be skipped`
    )

  console.info(
    `poster-video: extracting ${fps}fps frames from ${path.basename(input_path)}`
  )
  await exec('ffmpeg', [
    '-y',
    '-i',
    input_path,
    '-vf',
    `fps=${fps},scale='min(1200,iw)':-2`,
    `${source_dir}/frame-%05d.png`
  ])
  mark('extract')
  const frame_files = fs
    .readdirSync(source_dir)
    .filter(name => name.endsWith('.png'))
    .sort()
  if (!frame_files.length) throw new Error('no frames extracted')
  console.info(`poster-video: ${frame_files.length} frames`)
  const n_workers = Math.min(workers, frame_files.length)
  console.info(
    `poster-video: ${n_workers} worker(s), ${os.availableParallelism?.() ?? '?'} cores`
  )

  // Partition [0, frame_count) into contiguous slices.
  const slices = []
  const base = Math.floor(frame_files.length / n_workers)
  const rem = frame_files.length % n_workers
  let cursor = 0
  for (let w = 0; w < n_workers; w++) {
    const size = base + (w < rem ? 1 : 0)
    slices.push({ start: cursor, end: cursor + size })
    cursor += size
  }

  const children = slices.map((slice, w) => {
    const opts = {
      worker_id: w,
      source_dir,
      poster_dir,
      start: slice.start,
      end: slice.end,
      debug_port: DEBUG_PORT + w
    }
    return fork(__filename, [WORKER_FLAG, JSON.stringify(opts)], {
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    })
  })

  const cleanup_tmp = () => {
    try {
      rmSync(tmp, { recursive: true, force: true })
    } catch {
      console.warn('poster-video: left temp dir behind')
    }
  }
  // On close, terminate the workers so their browsers aren't orphaned, then
  // leave the rendered frames in place for a resumable rerun.
  for (const sig of ['SIGINT', 'SIGTERM'])
    process.once(sig, () => {
      for (const child of children)
        child.kill(sig === 'SIGINT' ? 'SIGINT' : 'SIGTERM')
      cleanup_tmp()
      process.exit(sig === 'SIGINT' ? SIGINT_EXIT : SIGTERM_EXIT)
    })

  try {
    const exit_codes = await Promise.all(
      children.map(
        child =>
          new Promise(resolve => {
            child.on('exit', code => resolve(code))
          })
      )
    )
    mark('render')
    const failed = exit_codes.filter(code => code !== 0).length
    if (failed > 0)
      throw new Error(
        `${failed}/${n_workers} workers failed (codes ${exit_codes.join(',')})`
      )

    const out_file = path.join(out_dir, `${stem}.mp4`)
    fs.mkdirSync(out_dir, { recursive: true })
    const rendered_frames = fs
      .readdirSync(poster_dir)
      .filter(name => name.endsWith('.png')).length
    console.info(
      `poster-video: encoding ${rendered_frames} frames -> ${path.basename(out_file)}`
    )
    await exec('ffmpeg', [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      `${poster_dir}/poster-%05d.png`,
      // libx264 + yuv420p requires even dimensions; traced posters can be odd
      '-vf',
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      out_file
    ])
    mark('encode')
    console.info(
      `poster-video: phases ${JSON.stringify({
        total_ms: Date.now() - t0,
        extract_ms: phase_time.extract - t0,
        render_ms: phase_time.render - phase_time.extract,
        encode_ms: phase_time.encode - phase_time.render,
        frames: frame_files.length,
        workers: n_workers
      })}`
    )
    console.info(`poster-video: wrote ${out_file}`)
    console.info(`poster-video: kept frames in ${poster_dir}`)
  } finally {
    cleanup_tmp()
  }
}

if (worker_opts)
  run_worker(worker_opts)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(`poster-video: worker ${error.message}`)
      process.exit(1)
    })
else
  run_master()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(`poster-video: ${error.message}`)
      process.exit(1)
    })
