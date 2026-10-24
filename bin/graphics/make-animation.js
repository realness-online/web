#!/usr/bin/env node

import { spawn, fork } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { mkdtempSync as mkdtemp_sync, rmSync as rm_sync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  chrome_path,
  data_url_of,
  open_driver,
  trace
} from '../lib/poster-driver.js'

const __dirname = path.dirname(file_url_to_path(import.meta.url))
const __filename = file_url_to_path(import.meta.url)
const realness_root = path.join(__dirname, '../..')
const out_dir = path.join(realness_root, 'artifacts', 'animation')

const PROGRESS_TICK_MS = 500
const US_PER_SECOND = 1e6
const STATUS_PAD = 48
const DEBUG_PORT = 9335
const DEFAULT_FPS = 24
const DEFAULT_WORKERS = 6
const AUDIO_BITRATE = '192k'
const DEFAULT_CRF = 23
const CRF_MIN = 0
const CRF_MAX = 51
const BYTES_PER_MB = 1e6
const ERR_TAIL_LINES = 4
const SIGINT_EXIT = 130
const SIGTERM_EXIT = 143

const PNG_SIGNATURE = Buffer.from('\x89PNG\r\n\x1a\n', 'binary')
const CHUNK_TYPE_AT = 12
const CHUNK_TYPE_END = 16
const WIDTH_AT = 16
const HEIGHT_AT = 20
const IHDR_HEADER_BYTES = 24

/**
 * The pixel size to rasterize a traced poster at. The svg is the master and
 * has no resolution of its own, so `target_width` picks any size off the same
 * geometry; zero keeps the width it was traced at.
 *
 * Dimensions come back even - libx264 with yuv420p rejects odd ones, and
 * rounding here beats padding a stray line of pixels on at encode time.
 *
 * @param {string} svg
 * @param {number} [target_width]
 * @returns {{ width: number, height: number } | null}
 */
const poster_raster_size = (svg, target_width = 0) => {
  const viewbox = /viewBox="([^"]+)"/.exec(svg ?? '')?.[1]
  if (!viewbox) return null
  const [, , traced_width, traced_height] = viewbox
    .trim()
    .split(/\s+/)
    .map(Number)
  if (!(traced_width > 0) || !(traced_height > 0)) return null
  const even = value => Math.round(value / 2) * 2
  const width = even(target_width > 0 ? target_width : traced_width)
  return { width, height: even((width * traced_height) / traced_width) }
}

/**
 * Read a png's dimensions from its IHDR chunk, which is always the first 24
 * bytes. Enough to tell whether a frame on disk was rastered at the size this
 * run wants, without reading a multi-megabyte file to find out.
 *
 * @param {Buffer} [buffer] - at least the first 24 bytes of the file
 * @returns {{ width: number, height: number } | null}
 */
const read_png_size = buffer => {
  if (!buffer || buffer.length < IHDR_HEADER_BYTES) return null
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE))
    return null
  if (buffer.toString('ascii', CHUNK_TYPE_AT, CHUNK_TYPE_END) !== 'IHDR')
    return null
  return {
    width: buffer.readUInt32BE(WIDTH_AT),
    height: buffer.readUInt32BE(HEIGHT_AT)
  }
}

/**
 * Drop the rastered pngs from a frame directory, leaving the traced svgs.
 *
 * The pngs are scratch: the svgs beside them are the master and re-raster at
 * any width without re-tracing, so a finished encode has no reason to keep
 * gigabytes of them. Only `.png` is touched - everything else stays.
 *
 * @param {string} poster_dir
 * @returns {{ count: number, bytes: number }}
 */
const clear_raster_frames = poster_dir => {
  const frames = fs
    .readdirSync(poster_dir)
    .filter(name => name.endsWith('.png'))
    .map(name => path.join(poster_dir, name))
  const bytes = frames.reduce((total, file) => total + fs.statSync(file).size, 0)
  for (const file of frames) fs.rm_sync(file)
  return { count: frames.length, bytes }
}

const fail = message => {
  console.error(`make-animation: ${message}`)
  process.exit(1)
}

const [, , arg_one, arg_two] = process.argv
const WORKER_FLAG = '--worker'
let worker_opts = null
let input_path = null
let fps = DEFAULT_FPS
let workers = DEFAULT_WORKERS
let width = 0
let crf = DEFAULT_CRF
let keep_frames = false

if (arg_one === WORKER_FLAG) worker_opts = JSON.parse(arg_two)
else {
  input_path = arg_one
  const rest = process.argv.slice(3)
  for (let index = 0; index < rest.length; index++) {
    const token = rest[index] ?? ''
    if (token === '--fps') fps = Number(rest[index + 1]) || DEFAULT_FPS
    if (token === '--workers') {
      const n = Number(rest[index + 1])
      if (Number.isInteger(n) && n > 0) workers = n
    }
    if (token === '--width') {
      const n = Number(rest[index + 1])
      if (Number.isInteger(n) && n > 0) width = n
    }
    if (token === '--crf') {
      const n = Number(rest[index + 1])
      if (Number.isInteger(n) && n >= CRF_MIN && n <= CRF_MAX) crf = n
    }
    if (token === '--keep-frames') keep_frames = true
  }
  if (!input_path)
    fail(
      'usage: npm run make:animation <video> [--fps N] [--workers N] [--width N] [--crf N] [--keep-frames]'
    )
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

const extract_frames = (video_path, fps, pattern, on_progress) =>
  new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-y',
      '-i',
      video_path,
      '-vf',
      `fps=${fps},scale='min(1200,iw)':-2`,
      '-progress',
      'pipe:2',
      '-nostats',
      pattern
    ])
    let stderr = ''
    let last_tick = 0
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
      const now = Date.now()
      if (now - last_tick < PROGRESS_TICK_MS) return
      last_tick = now
      const frame = Number(/frame=(\d+)/.exec(stderr)?.[1] ?? 0)
      const us = Number(/out_time_us=(\d+)/.exec(stderr)?.[1] ?? 0)
      on_progress?.(frame, us / US_PER_SECOND)
    })
    child.on('close', code => {
      if (code === 0) resolve()
      else
        reject(new Error(stderr.split('\n').slice(-ERR_TAIL_LINES).join('\n')))
    })
  })

const status = message => console.info(`make-animation: ${message}`)

/**
 * The size a png on disk was rastered at, or null when it isn't there.
 * Reads the IHDR header only - these files run to megabytes at 4k.
 */
const png_size_of = file => {
  if (!fs.existsSync(file)) return null
  const buffer = Buffer.alloc(IHDR_HEADER_BYTES)
  const handle = fs.openSync(file, 'r')
  try {
    fs.readSync(handle, buffer, 0, IHDR_HEADER_BYTES, 0)
  } finally {
    fs.closeSync(handle)
  }
  return read_png_size(buffer)
}

/**
 * Draw a traced poster svg to a canvas at an arbitrary size. The svg carries
 * its own symbols and gradients, so it rasterizes as a plain image with no
 * app around it - which is why a resize never re-traces.
 *
 * Chrome's own --screenshot path hangs on these files; the posters carry SMIL
 * `<animate>` elements and the page never settles. Drawing to a canvas takes
 * the first frame and returns.
 */
const rasterize = async (evaluate, svg, { width, height }) => {
  const data_url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  const base64 = await evaluate(`(async () => {
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('poster svg failed to load'))
      image.src = ${JSON.stringify(data_url)}
    })
    const canvas = new OffscreenCanvas(${width}, ${height})
    canvas.getContext('2d').drawImage(image, 0, 0, ${width}, ${height})
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index++)
      binary += String.fromCharCode(bytes[index])
    return btoa(binary)
  })()`)
  return Buffer.from(base64, 'base64')
}

const run_worker = async opts => {
  const {
    source_dir,
    poster_dir,
    start,
    end,
    debug_port,
    worker_id,
    target_width
  } = opts
  const frame_files = fs
    .readdirSync(source_dir)
    .filter(name => name.endsWith('.png'))
    .sort()

  const { evaluate, shutdown } = await open_driver({
    debug_port,
    name: 'make-animation'
  })
  try {
    for (let index = start; index < end; index++) {
      const frame_stem = `poster-${String(index + 1).padStart(5, '0')}`
      const out_png = path.join(poster_dir, `${frame_stem}.png`)
      const out_svg = path.join(poster_dir, `${frame_stem}.svg`)

      let svg = fs.existsSync(out_svg) ? fs.readFileSync(out_svg, 'utf8') : null

      if (!svg) {
        const frame = frame_files[index]
        status(
          `tracing ${index + 1}/${frame_files.length} (worker ${worker_id})`
        )
        const traced = await trace(
          evaluate,
          data_url_of(path.join(source_dir, frame)),
          { label: `frame ${index + 1}`, status }
        )
        svg = traced.svg
        fs.writeFileSync(out_svg, svg)
      }

      const size = poster_raster_size(svg, target_width)
      if (!size) throw new Error(`frame ${index + 1} svg has no usable viewBox`)

      if (png_size_of(out_png)?.width === size.width) {
        status(`skipping ${frame_stem} (already ${size.width}px)`)
        continue
      }

      status(
        `rastering ${index + 1}/${frame_files.length} at ${size.width}x${size.height} (worker ${worker_id})`
      )
      fs.writeFileSync(out_png, await rasterize(evaluate, svg, size))
    }
  } finally {
    shutdown()
  }
}

const run_master = async () => {
  const phase_time = {}
  const t0 = Date.now()
  const mark = name => {
    phase_time[name] = Date.now()
  }

  const tmp = mkdtemp_sync(path.join(tmpdir(), 'make-animation-'))
  const source_dir = path.join(tmp, 'source')
  const stem = path.basename(input_path, path.extname(input_path))
  const poster_dir = path.join(out_dir, `${stem}-frames`)
  fs.mkdirSync(source_dir, { recursive: true })
  fs.mkdirSync(poster_dir, { recursive: true })
  const traced = fs
    .readdirSync(poster_dir)
    .filter(name => name.endsWith('.svg')).length
  if (traced > 0)
    console.info(
      `make-animation: resuming - ${traced} frame(s) already traced will be reused`
    )
  if (width > 0) console.info(`make-animation: rastering posters ${width}px wide`)

  console.info(
    `make-animation: extracting ${fps}fps frames from ${path.basename(input_path)}`
  )
  let last_tick = 0
  await extract_frames(
    input_path,
    fps,
    `${source_dir}/frame-%05d.png`,
    (frame, seconds) => {
      const now = Date.now()
      if (now - last_tick < PROGRESS_TICK_MS) return
      last_tick = now
      process.stderr.write(
        `\rmake-animation: extracting ${frame} frames (${seconds.toFixed(1)}s)   `
      )
    }
  )
  process.stderr.write(`\r${' '.repeat(STATUS_PAD)}\r`)
  mark('extract')
  const frame_files = fs
    .readdirSync(source_dir)
    .filter(name => name.endsWith('.png'))
    .sort()
  if (!frame_files.length) throw new Error('no frames extracted')
  console.info(`make-animation: ${frame_files.length} frames`)
  const n_workers = Math.min(workers, frame_files.length)
  console.info(
    `make-animation: ${n_workers} worker(s), ${os.availableParallelism?.() ?? '?'} cores`
  )

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
      debug_port: DEBUG_PORT + w,
      target_width: width
    }
    return fork(__filename, [WORKER_FLAG, JSON.stringify(opts)], {
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    })
  })

  const cleanup_tmp = () => {
    try {
      rm_sync(tmp, { recursive: true, force: true })
    } catch {
      console.warn('make-animation: left temp dir behind')
    }
  }
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
    if (path.resolve(out_file) === path.resolve(input_path))
      throw new Error(`refusing to overwrite the source clip at ${out_file}`)
    fs.mkdirSync(out_dir, { recursive: true })
    const rendered_frames = fs
      .readdirSync(poster_dir)
      .filter(name => name.endsWith('.png')).length
    console.info(
      `make-animation: encoding ${rendered_frames} frames -> ${path.basename(out_file)}`
    )
    await exec('ffmpeg', [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      `${poster_dir}/poster-%05d.png`,
      '-i',
      input_path,
      '-vf',
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-map',
      '0:v',
      '-map',
      '1:a?',
      '-c:v',
      'libx264',
      '-crf',
      String(crf),
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      AUDIO_BITRATE,
      '-shortest',
      '-movflags',
      '+faststart',
      out_file
    ])
    mark('encode')
    console.info(
      `make-animation: phases ${JSON.stringify({
        total_ms: Date.now() - t0,
        extract_ms: phase_time.extract - t0,
        render_ms: phase_time.render - phase_time.extract,
        encode_ms: phase_time.encode - phase_time.render,
        frames: frame_files.length,
        workers: n_workers
      })}`
    )
    console.info(`make-animation: wrote ${out_file}`)
    if (keep_frames) console.info(`make-animation: kept frames in ${poster_dir}`)
    else {
      const freed = clear_raster_frames(poster_dir)
      console.info(
        `make-animation: cleared ${freed.count} raster frame(s), ${Math.round(freed.bytes / BYTES_PER_MB)}MB - kept the svgs in ${poster_dir}`
      )
    }
  } finally {
    cleanup_tmp()
  }
}

if (worker_opts)
  run_worker(worker_opts)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(`make-animation: worker ${error.message}`)
      process.exit(1)
    })
else
  run_master()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(`make-animation: ${error.message}`)
      process.exit(1)
    })
