import { execFile as exec_file_callback, spawn } from 'node:child_process'
import {
  cp,
  mkdir,
  readFile as read_file,
  rm,
  symlink,
  writeFile as write_file
} from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { pooled } from './chat-parts-eval.js'
import { run_entry } from './lib/entry.js'
import { sleep } from './lib/headless.js'

const exec_file = promisify(exec_file_callback)
const here = path.dirname(file_url_to_path(import.meta.url))
const app = path.resolve(here, '..')
const harness = path.resolve(app, '../..')
const out_root = path.join(harness, 'artifacts/ui-eval')
const JUDGE = 'openrouter/~openai/gpt-sol-latest'
const MINUTE_MS = 60_000
const SECOND_MS = 1000
const AGENT_MINUTES = 20
const AGENT_MS = AGENT_MINUTES * MINUTE_MS
const PARALLEL = 3
const PORT = 5391
const SESSION = 'ui-eval'
const PHONE = '4156667777'
const SIGN_IN_LOG = path.join(harness, 'artifacts/realness/local/sign-in.log')
const DIST_DIR = path.join(harness, 'artifacts/realness/frontend/dist')
const BOOT_MS = 10_000
const SETTLE_MS = 3_000
const DIFF_CHARS = 8_000
const UNRANKED = 99
const JUDGE_RUNS = 3
const HALF = 0.5
const DESKTOP_WIDTH = 1440
const DESKTOP_HEIGHT = 900
const PHONE_WIDTH = 390
const PHONE_HEIGHT = 844
const DESKTOP = [DESKTOP_WIDTH, DESKTOP_HEIGHT]
const PHONE_VIEW = [PHONE_WIDTH, PHONE_HEIGHT]
const SKIP = new Set(['node_modules', 'functions', 'tracer', '.fallow'])
const CHANNEL_TOLERANCE = 4
const BYTES_PER_PIXEL = 4
const COLOUR_CHANNELS = 3
const MIN_PIXELS = 100
const MIN_PIXEL_SHARE = 0.0002
const BASELINES = new Set(['before', 'current', 'blank'])

export const arms = [
  { name: 'none', flags: ['--no-skills'] },
  {
    name: 'user-experience',
    flags: [
      '--no-skills',
      '--skill',
      path.join(harness, '.pi/skills/user-experience')
    ]
  },
  {
    name: 'flawless-ui-ux',
    flags: [
      '--no-skills',
      '--skill',
      path.join(out_root, 'skills/flawless-ui-ux')
    ]
  }
]

const BUILT = 'document.body.innerText.trim().length > 40'

/**
 * Each arm starts from the same starter: the view's own script, no markup and
 * no styles. The current page is rendered too, as the house-style reference.
 */
export const tasks = [
  {
    name: 'chat',
    route: '/account',
    open_chat: true,
    file: 'src/app/components/chat/as-conversation.vue',
    heading: 'Conversation',
    expect: BUILT,
    reference: "Boolean(document.querySelector('aside#chat-panel[data-open]'))",
    ask: 'Build the chat conversation in src/app/components/chat/as-conversation.vue. The script carries the messages, commands, and sending; the template and styles are a blank starter.'
  },
  {
    name: 'thoughts',
    route: '/',
    file: 'src/app/views/Thoughts.vue',
    heading: 'Thoughts',
    expect: BUILT,
    reference: "Boolean(document.querySelector('section#thoughts'))",
    ask: 'Build the Thoughts page in src/app/views/Thoughts.vue. The script loads the feed, posters, and editing; the template and styles are a blank starter.'
  },
  {
    name: 'account',
    route: '/account',
    file: 'src/app/views/Account.vue',
    heading: 'Account',
    expect: BUILT,
    reference: "location.pathname === '/account'",
    ask: 'Build the account page in src/app/views/Account.vue. The script loads the settings and profile; the template and styles are a blank starter.'
  }
]

/** A view with its markup and styles removed: same script, blank page. */
export const starter_of = (source, heading) => {
  const script = source.match(/<script[\s\S]*?<\/script>/)?.[0]
  if (!script) throw new Error('starter: the view has no script block')
  return `${script}\n\n<template>\n  <main>\n    <h1>${heading}</h1>\n  </main>\n</template>\n`
}

export const viewports = [DESKTOP, PHONE_VIEW]

const rules =
  'This directory is a copy of the Realness app. Make the changes now, without asking first. Edit only files in this directory. Do not start servers, open browsers, install packages, or commit.'

/** Lines a unified diff adds, without the file headers. */
export const added_lines = diff =>
  diff
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1))

/** Template tells and invented colors among added lines. */
export const tells_in = lines => {
  const count = pattern => lines.filter(line => pattern.test(line)).length
  return {
    uppercase: count(/text-transform:\s*uppercase/),
    middle_dot: count(/\s·\s|&middot;/),
    arrow: count(/→|&rarr;/),
    numbered: count(/>\s*0[1-9]\s*</),
    new_color: count(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(/i)
  }
}

/** Scope of a diff: files touched and lines changed. */
export const scope_of = diff => ({
  files: (diff.match(/^diff --git /gm) ?? []).length,
  lines: diff.split('\n').filter(line => /^[+-](?![+-]{2})/.test(line)).length
})

export const probe = `(() => {
  const lum = rgb => {
    const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const parse = c => {
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = c
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const back = el => {
    for (let at = el; at; at = at.parentElement) {
      const c = parse(getComputedStyle(at).backgroundColor)
      if (c[3] > 0.5) return c.slice(0, 3)
    }
    return [255, 255, 255]
  }
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  let low_contrast = 0
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el) || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue
    const style = getComputedStyle(el)
    const a = lum(parse(style.color)), b = lum(back(el))
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700)
    if (ratio < (large ? 3 : 4.5)) low_contrast++
  }
  const small_targets = [...document.querySelectorAll('a, button, input, select, textarea, summary, [role=button]')]
    .filter(shown).filter(el => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24 }).length
  return {
    overflow: document.documentElement.scrollWidth > innerWidth,
    broken: Boolean(document.querySelector('vite-error-overlay')) || document.body.innerText.trim().length < 20,
    low_contrast,
    small_targets
  }
})()`

const open_chat = `(() => {
  if (document.querySelector('aside#chat-panel[data-open]')) return 'open'
  const button = [...document.querySelectorAll('button, a')].find(el => /open chat/i.test(el.getAttribute('aria-label') ?? el.innerText))
  button?.click()
  return button ? 'opened' : 'missing'
})()`

const close_chat = `(() => {
  const panel = document.querySelector('aside#chat-panel')
  if (!panel?.hasAttribute('data-open')) return 'closed'
  const button = [...panel.querySelectorAll('button, a')].find(el => /close chat/i.test(el.getAttribute('aria-label') ?? el.innerText))
  button?.click()
  return button ? 'closed' : 'missing'
})()`

const run = (command, args, options = {}) =>
  new Promise(resolve => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', chunk => (out += chunk))
    child.on('close', code => resolve({ code, out }))
  })

const make_fixture = async dir => {
  await cp(app, dir, {
    recursive: true,
    filter: source => !SKIP.has(path.basename(source))
  })
  await symlink(path.join(app, 'node_modules'), path.join(dir, 'node_modules'))
}

const apply_starter = async (dir, task) => {
  const file = path.join(dir, task.file)
  const source = await read_file(file, 'utf8')
  await write_file(file, starter_of(source, task.heading))
}

const diff_of = async (base, dir) => {
  const { out } = await run('git', [
    'diff',
    '--no-index',
    '--no-color',
    path.join(base, 'src'),
    path.join(dir, 'src')
  ])
  return out.replaceAll(base, '').replaceAll(dir, '')
}

const browse = (session, ...args) =>
  exec_file('agent-browser', ['--session', session, ...args], {
    timeout: MINUTE_MS
  }).then(
    ({ stdout }) => stdout.trim(),
    error => String(error.message)
  )

const serve = async dir => {
  const server = spawn(
    path.join(dir, 'node_modules/.bin/vp'),
    ['dev', '--mode', 'dev-local', '--port', String(PORT), '--strictPort'],
    {
      cwd: dir,
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, DIST_DIR }
    }
  )
  const exited = new Promise(resolve => {
    server.once('exit', resolve)
  })
  await sleep(BOOT_MS)
  if (server.exitCode !== null)
    throw new Error(`dev server exited; is port ${PORT} free?`)
  return () => {
    process.kill(-server.pid)
    return exited
  }
}

const latest_code = async () => {
  const { out } = await run('grep', [`+1${PHONE}`, SIGN_IN_LOG])
  return out.trim().split('\n').at(-1)?.split(' ').at(-1) ?? ''
}

const ref_of = async (session, pattern) => {
  const tree = await browse(session, 'snapshot', '-i')
  const line = tree.split('\n').find(line => pattern.test(line))
  return line?.match(/ref=(e\d+)/)?.[1]
}

const press = (session, label) =>
  browse(
    session,
    'eval',
    `[...document.querySelectorAll('button')].find(b => ${label}.test(b.textContent.trim()))?.click()`
  )

/** Walk the sign-on page to a signed-in session in the shared browser. */
export const sign_on = async () => {
  const session = SESSION
  await browse(session, 'open', `http://localhost:${PORT}/sign-on`)
  await sleep(SETTLE_MS)
  const before = await latest_code()
  await browse(session, 'find', 'label', 'Phone number', 'fill', PHONE)
  await press(session, /^text me a code$/i)
  await sleep(SETTLE_MS)
  const code = await latest_code()
  if (!code || code === before)
    throw new Error('sign-in: no new code in sign-in.log; is npm run local up?')
  const field = await ref_of(session, /textbox "6-digit code"/)
  const verify = await ref_of(session, /button "Verify"/)
  if (!field || !verify)
    throw new Error('sign-in: no code step; is the sign-in service up?')
  await browse(session, 'type', `@${field}`, code)
  await browse(session, 'click', `@${verify}`)
  await sleep(SETTLE_MS * 2)
  const where = await browse(session, 'eval', 'location.pathname')
  if (where.includes('sign-on')) throw new Error(`sign-in: still on ${where}`)
}

/** Sign in against a fresh server, for work that runs outside render. */
export const sign_in = async dir => {
  const stop = await serve(dir)
  try {
    await sign_on()
  } finally {
    await stop()
  }
}

export const render = async job => {
  await mkdir(job.out, { recursive: true })
  const stop = await serve(job.dir)
  const session = SESSION
  const shots = []
  const states = []
  try {
    for (const [width, height] of viewports) {
      await browse(session, 'set', 'viewport', String(width), String(height))
      const url = `http://localhost:${PORT}${job.task.route}`
      await browse(session, 'open', url)
      await sleep(SETTLE_MS)
      if (
        (await browse(session, 'eval', 'location.pathname')).includes('sign-on')
      ) {
        await sign_on()
        await browse(session, 'open', url)
        await sleep(SETTLE_MS)
      }
      await browse(session, 'eval', job.task.open_chat ? open_chat : close_chat)
      await sleep(SETTLE_MS)
      const shot = path.join(
        job.out,
        `${job.task.name}-${job.arm.name}-${width}.png`
      )
      await browse(session, 'screenshot', shot)
      shots.push(shot)
      const measured = JSON.parse(
        (await browse(session, 'eval', probe)) || '{}'
      )
      const check = job.check ?? job.task.expect
      const on_screen = check ? await browse(session, 'eval', check) : 'true'
      if (on_screen !== 'true')
        Object.assign(measured, {
          broken: true,
          reason: 'target not on screen'
        })
      const errors = await browse(session, 'errors', '--clear')
      states.push({
        width,
        ...measured,
        errors:
          errors && !/no (page )?errors/i.test(errors)
            ? errors.split('\n').length
            : 0
      })
    }
  } finally {
    await stop()
  }
  return { shots, states }
}

const do_job = async (job, model) => {
  const extra = model ? ['--model', model] : []
  const started = Date.now()
  const agent = await run(
    path.join(harness, '.pi/bin/pi'),
    [
      '-p',
      '--no-session',
      '--no-extensions',
      ...extra,
      ...job.arm.flags,
      `${job.task.ask}\n\n${rules}`
    ],
    { cwd: job.dir, timeout: AGENT_MS }
  )
  const diff = await diff_of(job.baseline ?? job.base, job.dir)
  const check = await run(
    path.join(job.dir, 'node_modules/.bin/vp'),
    ['check', 'src/app'],
    { cwd: job.dir }
  )
  return {
    seconds: Math.round((Date.now() - started) / SECOND_MS),
    reply: agent.out.trim(),
    agent_ok: agent.code === 0,
    diff,
    scope: scope_of(diff),
    tells: tells_in(added_lines(diff)),
    check_ok: check.code === 0
  }
}

const letters = 'ABCDEFGH'

/** A page that did not render cannot be ranked above one that did. */
export const settle = list => {
  const broken = row => row.states.some(state => state.broken)
  const unchanged = row => row.visible === false
  const rankable = list
    .filter(row => !broken(row) && !unchanged(row))
    .sort((a, b) => (a.rank || UNRANKED) - (b.rank || UNRANKED))
  rankable.forEach((row, at) => {
    row.rank = at + 1
  })
  list
    .filter(row => !broken(row) && unchanged(row))
    .forEach(row => {
      row.rank = undefined
      row.better = false
      row.note =
        'No visible change: the screenshots match the original, so it cannot be ranked.'
    })
  list.filter(broken).forEach((row, at) => {
    row.rank = rankable.length + at + 1
    row.better = false
    row.note = `Did not render (Vite error overlay) at ${row.states
      .filter(state => state.broken)
      .map(state => state.width)
      .join(' and ')} wide. Its measurements and screenshots are ignored.`
  })
  return list
}

const judge = async (task, before, results, out, attempt = 0) => {
  const order = results.map((_, at) => at).sort(() => Math.random() - HALF)
  const shown = (shots, first) =>
    `${shots.map((_, n) => `image ${first + n + 1}`).join(', ')} (${viewports.map(v => v[0]).join(', ')} wide)`
  const sections = order.map(
    (at, slot) =>
      `## Proposal ${letters[slot]}\nScreenshots: ${shown(results[at].shots, (slot + 1) * viewports.length)}\n\nDiff:\n\`\`\`diff\n${results[at].diff.slice(0, DIFF_CHARS) || '(no change)'}\n\`\`\``
  )
  const prompt = `Several designers were each asked: "${task.ask}" for the same app. Each started from the same blank starter, which held the data and none of the markup. Judge the results as a senior UI designer. The first images are the app's current page, done by hand: compare every proposal with it first. Does it reach the person as well as the current page, or fall short? Weigh usability, clarity, hierarchy, accessibility, and fit with the house style. A proposal that is worse than the current page should say so. The images are in order: the current page, then the proposals.\n\n## Current page\nScreenshots: ${shown(before.shots, 0)}\n\n${sections.join('\n\n')}\n\nAnswer with JSON only, no fence: {"ranking":["A",...best first],"better_than_original":{"A":true|false,...},"notes":{"A":"one sentence on what changed for the user",...}}`
  const prompt_file = path.join(
    out,
    `${task.name}-judge${attempt ? `-${attempt + 1}` : ''}.md`
  )
  await write_file(prompt_file, prompt)
  const images = [
    ...before.shots,
    ...order.flatMap(at => results[at].shots)
  ].map(shot => `@${shot}`)
  const { out: reply } = await run(
    path.join(harness, '.pi/bin/pi'),
    [
      '-p',
      '--no-session',
      '--no-extensions',
      '--no-skills',
      '--model',
      JUDGE,
      ...images,
      `@${prompt_file}`
    ],
    { cwd: harness }
  )
  await write_file(
    path.join(
      out,
      `${task.name}-judge${attempt ? `-${attempt + 1}` : ''}-reply.txt`
    ),
    reply
  )
  const found = reply.match(/\{[\s\S]*\}/)
  const parsed = found ? JSON.parse(found[0]) : { ranking: [], notes: {} }
  if (!parsed.ranking?.length)
    throw new Error(`judge gave no ranking for ${task.name}`)
  return Object.fromEntries(
    order.map((at, slot) => [
      results[at].arm,
      {
        rank: parsed.ranking.indexOf(letters[slot]) + 1,
        better: parsed.better_than_original?.[letters[slot]],
        note: parsed.notes?.[letters[slot]] ?? ''
      }
    ])
  )
}

/** The median of whole numbers; the lower one when the count is even. */
export const median = numbers => {
  const sorted = [...numbers].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

/** True when one side of a split verdict has the majority. */
const majority = (verdicts, value) =>
  verdicts.filter(verdict => verdict.better === value).length

/** One verdict per arm from several judgments, so a single call cannot decide. */
export const judge_many = async ({
  task,
  before,
  results,
  out,
  times = JUDGE_RUNS,
  call = judge
}) => {
  const runs = []
  for (let attempt = 0; attempt < times; attempt++)
    runs.push(await call(task, before, results, out, attempt))
  return Object.fromEntries(
    results.map(({ arm }) => {
      const verdicts = runs.map(run => run[arm])
      const ranks = verdicts.map(verdict => verdict.rank).filter(Boolean)
      const wins = majority(verdicts, true)
      const losses = majority(verdicts, false)
      return [
        arm,
        {
          rank: ranks.length === verdicts.length ? median(ranks) : undefined,
          ranks,
          better: wins === losses ? undefined : wins > losses,
          note: verdicts[0].note
        }
      ]
    })
  )
}

/** Pixels whose colour moved, between two RGBA buffers of one size. */
export const pixel_diff = (left, right) => {
  let pixels = 0
  for (let at = 0; at < left.length; at += BYTES_PER_PIXEL)
    for (let channel = 0; channel < COLOUR_CHANNELS; channel++)
      if (
        Math.abs(left[at + channel] - right[at + channel]) > CHANNEL_TOLERANCE
      ) {
        pixels++
        break
      }
  return { pixels, total: left.length / BYTES_PER_PIXEL }
}

/** A page counts as changed only when the change moves real pixels. */
export const changed_enough = ({ pixels, total }) =>
  pixels >= MIN_PIXELS && pixels / total >= MIN_PIXEL_SHARE

/** Whether any screenshot differs from the original's screenshot of the same width. */
export const visible_change = async (shots, before) => {
  const read = file =>
    sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => ({
        data,
        width: info.width,
        height: info.height
      }))
  for (const [at, shot] of shots.entries()) {
    const was = before[at]
    const [left, right] = await Promise.all([read(was), read(shot)])
    if (left.width !== right.width || left.height !== right.height) return true
    if (changed_enough(pixel_diff(left.data, right.data))) return true
  }
  return false
}

const escape = text =>
  String(text).replace(
    /[&<>"]/g,
    c => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`
  )

/** How one arm landed against the current page. */
const judge_word = better => {
  if (better === true) return 'reaches'
  if (better === false) return 'below'
  return 'unjudged'
}

/** Arm name, rank, and lint under a screenshot. */
const caption = row => {
  if (!row) return ''
  if (row.arm === 'current') return 'Current page, done by hand'
  if (row.arm === 'blank') return 'Blank starter, what every arm began with'
  return `${escape(row.arm)} - rank ${row.rank || '-'}${
    row.ranks?.length > 1 ? ` (${row.ranks.join(', ')})` : ''
  }, ${judge_word(row.better)}${row.check_ok === false ? ', lint fails' : ''}`
}

/** Each task, one strip per viewport: the current page first, then the proposals. */
export const compare_html = (rows, stamp) => {
  const by_task = Object.groupBy(rows, row => row.task)
  const strips = Object.entries(by_task).map(([task, list]) => {
    const pick = name => list.find(row => row.arm === name)
    const proposals = list
      .filter(row => !BASELINES.has(row.arm))
      .sort((a, b) => (a.rank || UNRANKED) - (b.rank || UNRANKED))
    const strip = width =>
      [pick('current'), pick('blank'), ...proposals]
        .map(row => {
          const file = (row?.shots ?? []).find(shot =>
            shot.includes(`-${width}.png`)
          )
          if (!file) return ''
          const base = path.basename(file)
          return `<figure class="${row.arm === 'current' ? 'current' : 'arm'}">
        <a href="${escape(base)}"><img src="${escape(base)}" alt="${escape(`${task} ${row.arm} ${width}`)}" loading="lazy"></a>
        <figcaption>${caption(row)}</figcaption>
      </figure>`
        })
        .join('\n')
    return `<section itemscope itemtype="https://schema.org/Review">
  <h2 itemprop="itemReviewed">${escape(task)}</h2>
  <h3>Wide, ${DESKTOP[0]} wide</h3>
  <div class="strip wide">
${strip(DESKTOP[0])}
  </div>
  <h3>Phone, ${PHONE_VIEW[0]} wide</h3>
  <div class="strip narrow">
${strip(PHONE_VIEW[0])}
  </div>
</section>`
  })
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>UI skill eval, side by side ${escape(stamp)}</title>
<style>
  body { margin: 0; padding: 1rem; font: 400 15px/1.4 system-ui, sans-serif; background: Canvas; color: CanvasText; }
  h1 { font-size: 1.2rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 0.5rem; }
  h3 { font-size: 0.85rem; font-weight: 500; opacity: 0.7; margin: 1rem 0 0.35rem; }
  p { margin: 0 0 1rem; opacity: 0.8; }
  .strip { display: grid; gap: 0.5rem; align-items: start; }
  .strip.wide { grid-template-columns: repeat(2, 1fr); }
  .strip.narrow { grid-template-columns: repeat(4, minmax(0, 160px)); }
  figure { margin: 0; display: flex; flex-direction: column; }
  figure figcaption { order: -1; padding: 0 0 0.25rem; font-weight: 600; }
  figure img { display: block; width: 100%; height: auto; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); }
  figure.current img { outline: 2px solid highlight; }
  figcaption { font-size: 0.8rem; }
  body.blind figcaption { visibility: hidden; }
</style>
<main>
  <h1>UI skill eval, side by side</h1>
  <p>${escape(stamp)}. Each strip: the current page, the blank starter every arm began from, then the proposals. Outline marks the current page, the house style. Click a screenshot for full size. <label><input type="checkbox" onchange="document.body.classList.toggle('blind', this.checked)"> Hide the verdicts</label></p>
${strips.join('\n')}
</main>
</html>
`
}

/** Both pages beside a run: the table and the side-by-side compare. */
const write_report = async (dir, stamp, model, rows, befores) => {
  await write_file(
    path.join(dir, 'index.html'),
    report_html(stamp, model, rows, befores)
  )
  await write_file(path.join(dir, 'compare.html'), compare_html(rows, stamp))
  console.info(path.relative(harness, path.join(dir, 'compare.html')))
}

export const report_html = (stamp, model, rows, befores = {}) => {
  const by_task = Object.groupBy(rows, row => row.task)
  const against = (task, row, key) =>
    row.states
      .map(state => {
        const was = befores[task]?.states.find(
          other => other.width === state.width
        )
        if (!was) return `${state.width}: ${state[key]}`
        if (key === 'overflow')
          return `${state.width}: ${state[key] ? 'yes' : 'no'}`
        const delta = state[key] - was[key]
        return `${state.width}: ${state[key]} (${delta > 0 ? '+' : ''}${delta})`
      })
      .join('<br>')
  const articles = Object.entries(by_task)
    .map(
      ([task, list]) => `<section>
  <h2>${escape(task)}</h2>
  <table>
    <thead><tr><th>Arm</th><th>Rank</th><th>Better</th><th>Files</th><th>Lines</th><th>Lint</th><th>Page</th><th>Visible</th><th>Tells</th><th>Overflow</th><th>Low contrast</th><th>Small targets</th><th>Errors</th><th>Seconds</th></tr></thead>
    <tbody>
${list
  .sort((a, b) => (a.rank || UNRANKED) - (b.rank || UNRANKED))
  .map(
    row => `      <tr itemscope itemtype="https://schema.org/CreativeWork">
        <th itemprop="name">${escape(row.arm)}</th><td>${row.rank || '-'}${
          row.rank && row.ranks?.length > 1
            ? `<small> ${row.ranks.join(', ')}</small>`
            : ''
        }</td><td>${{ true: 'yes', false: 'no' }[row.better] ?? '-'}</td><td>${row.scope.files}</td><td>${row.scope.lines}</td><td>${row.check_ok ? 'pass' : 'fail'}</td><td>${row.states.some(state => state.broken) ? 'broken' : 'renders'}</td><td>${{ true: 'yes', false: 'no' }[row.visible] ?? '-'}</td>
        <td>${escape(
          Object.entries(row.tells)
            .filter(([, n]) => n)
            .map(([k, n]) => `${k} ${n}`)
            .join(', ') || '-'
        )}</td>
        <td>${against(task, row, 'overflow')}</td>
        <td>${against(task, row, 'low_contrast')}</td>
        <td>${against(task, row, 'small_targets')}</td>
        <td>${against(task, row, 'errors')}</td>
        <td>${row.seconds}</td>
      </tr>
      <tr><td colspan="13"><p itemprop="review">${escape(row.note)}</p>${row.shots.map(shot => `<img src="${escape(path.basename(shot))}" alt="${escape(`${task} ${row.arm}`)}" width="360" loading="lazy">`).join('')}
        <details><summary>Agent reply</summary><pre>${escape(row.reply)}</pre></details>
        <details><summary>Diff</summary><pre>${escape(row.diff)}</pre></details></td></tr>`
  )
  .join('\n')}
    </tbody>
  </table>
</section>`
    )
    .join('\n')
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>UI skill eval ${escape(stamp)}</title>
<main itemscope itemtype="https://schema.org/Dataset">
  <h1 itemprop="name">UI skill eval</h1>
  <p><time itemprop="dateCreated">${escape(stamp)}</time>, producer <span itemprop="creator">${escape(model || 'default')}</span>, judge ${escape(JUDGE)}</p>
  <p><a href="compare.html">Side by side</a> - the current page and every proposal at both widths.</p>
  <p>Every arm began from the same <em>blank</em> starter: the view's own script with no markup and no styles. <em>Current</em> is the page done by hand, the house-style reference the judge compares against. Rank is the median of ${JUDGE_RUNS} judgments; the small numbers are each judgment's rank. <em>Better</em> is a majority verdict on reaching the current page. Lint is <code>vp check src/app</code>: formatting and lint only. Whether the page compiles is decided by the <em>Page</em> column, read from the Vite error overlay in a real browser. <em>Visible</em> means the screenshots differ from the starter's by more than antialiasing; a proposal with no visible change is not ranked. Counts are the change from the starter; a page that does not render is ranked last and its numbers are ignored.</p>
${articles}
</main>
</html>
`
}

/** A saved run's rows and screenshots, read back for a replay or a report. */
const read_run = async dir =>
  JSON.parse(await read_file(path.join(dir, 'run.json'), 'utf8'))

const save_run = (dir, run) =>
  write_file(path.join(dir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`)

/** Judge every saved proposal, so a replay or a report agrees with the run. */
const judge_saved = async ({ saved, out, show_change = false }) => {
  for (const name of Object.keys(saved.befores)) {
    const task = tasks.find(candidate => candidate.name === name)
    const list = saved.rows.filter(
      row => row.task === name && !BASELINES.has(row.arm)
    )
    const verdict = await judge_many({
      task,
      before: saved.references?.[name] ?? saved.befores[name],
      results: list,
      out
    })
    for (const row of list) {
      Object.assign(row, verdict[row.arm])
      if (show_change)
        row.visible = await visible_change(row.shots, saved.befores[name].shots)
    }
    settle(list)
  }
}

/** Write a saved run's report and print where it landed. */
const print_report = async (dir, saved) => {
  await write_report(dir, saved.stamp, saved.model, saved.rows, saved.befores)
  console.info(path.relative(harness, path.join(dir, 'index.html')))
}

/** Re-render a saved run's screenshots, judge them again, and rewrite it. */
const replay_run = async (replay, saved) => {
  const work = path.join(replay, 'replay')
  for (const row of saved.rows) {
    const dir = path.join(work, `${row.task}-${row.arm}`)
    const diff = path.join(work, `${row.task}-${row.arm}.diff`)
    await make_fixture(dir)
    await write_file(diff, row.diff)
    const patch = await run('patch', ['-p1', '-i', diff], { cwd: dir })
    if (patch.code !== 0) console.info(`patch failed ${row.task} ${row.arm}`)
    const shots = await render({
      task: tasks.find(task => task.name === row.task),
      arm: { name: row.arm },
      dir,
      out: replay
    })
    Object.assign(row, shots)
    await rm(dir, { recursive: true, force: true })
  }
  await judge_saved({ saved, out: replay })
  await rm(work, { recursive: true, force: true })
  await save_run(replay, saved)
  await print_report(replay, saved)
}

/** The shared page every arm starts from, one blank per task, one dir per job. */
const build_fixtures = async (out, picked) => {
  const base = path.join(out, 'base')
  await make_fixture(base)
  const blanks = {}
  for (const task of picked) {
    const dir = path.join(out, `blank-${task.name}`)
    await make_fixture(dir)
    await apply_starter(dir, task)
    blanks[task.name] = dir
  }
  const jobs = []
  for (const task of picked)
    for (const arm of arms) {
      const dir = path.join(out, `${task.name}-${arm.name}`)
      await make_fixture(dir)
      await apply_starter(dir, task)
      jobs.push({ task, arm, dir, base, out, baseline: blanks[task.name] })
    }
  return { base, blanks, jobs }
}

/** Run every job's agent, a few at a time, reporting each as it lands. */
const run_jobs = (jobs, model) =>
  pooled(
    jobs.map(job => async () => {
      console.info(`start ${job.task.name} ${job.arm.name}`)
      const result = await do_job(job, model)
      console.info(
        `done  ${job.task.name} ${job.arm.name} ${result.scope.files} files ${result.seconds}s`
      )
      return result
    }),
    PARALLEL
  )

/** The current page and the blank starter, shot once for every task. */
const reference_shots = async ({ picked, base, blanks, out }) => {
  await sign_in(base)
  const references = {}
  const befores = {}
  for (const task of picked) {
    references[task.name] = await render({
      task,
      arm: { name: 'current' },
      dir: base,
      out,
      check: task.reference
    })
    befores[task.name] = await render({
      task,
      arm: { name: 'blank' },
      dir: blanks[task.name],
      out
    })
  }
  return { references, befores }
}

/** One row per job: what the arm changed and what it looks like now. */
const rendered_rows = async ({ jobs, done, befores }) => {
  const rows = []
  for (const [at, job] of jobs.entries()) {
    const rendered = await render(job)
    rows.push({
      task: job.task.name,
      arm: job.arm.name,
      visible: await visible_change(
        rendered.shots,
        befores[job.task.name].shots
      ),
      ...done[at],
      ...rendered
    })
  }
  return rows
}

/** The current page and the blank starter, as rows the report shows first. */
const baseline_rows = (task, note, shots) => ({
  task: task.name,
  scope: { files: 0, lines: 0 },
  tells: {},
  check_ok: true,
  seconds: 0,
  note,
  reply: '',
  diff: '',
  ...shots
})

/** Judge every proposal, then add the current page and the blank starter. */
const judge_rows = async ({ picked, rows, references, befores, out }) => {
  for (const task of picked) {
    const list = rows.filter(row => row.task === task.name)
    const verdict = await judge_many({
      task,
      before: references[task.name],
      results: list,
      out
    })
    for (const row of list) Object.assign(row, verdict[row.arm])
    settle(list)
    rows.push(
      {
        ...baseline_rows(
          task,
          'The current page, the house-style reference.',
          references[task.name]
        ),
        arm: 'current'
      },
      {
        ...baseline_rows(
          task,
          'The starter every arm began from.',
          befores[task.name]
        ),
        arm: 'blank'
      }
    )
  }
}

/** Remove the fixtures a run leaves behind. */
const clear_fixtures = async ({ jobs, blanks, base }) => {
  for (const job of jobs) await rm(job.dir, { recursive: true, force: true })
  for (const dir of Object.values(blanks))
    await rm(dir, { recursive: true, force: true })
  await rm(base, { recursive: true, force: true })
}

/** Run every task under every arm, measure, judge, and write the report. */
const run_eval = async ({ model, only }) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const out = path.join(out_root, stamp)
  await mkdir(out, { recursive: true })
  const picked = tasks.filter(task => !only || task.name === only)
  const { base, blanks, jobs } = await build_fixtures(out, picked)
  const done = await run_jobs(jobs, model)
  const { references, befores } = await reference_shots({
    picked,
    base,
    blanks,
    out
  })
  const rows = await rendered_rows({ jobs, done, befores })
  await browse(SESSION, 'close')

  const save = () =>
    save_run(out, { stamp, model, judge: JUDGE, references, befores, rows })
  await save()
  try {
    await judge_rows({ picked, rows, references, befores, out })
    await save()
    await write_report(out, stamp, model, rows, befores)
  } finally {
    await clear_fixtures({ jobs, blanks, base })
  }
  console.info(path.relative(harness, path.join(out, 'index.html')))
}

export const main = async ({ args = process.argv.slice(2) } = {}) => {
  const option = name => {
    const at = args.indexOf(`--${name}`)
    return at === -1 ? undefined : args[at + 1]
  }
  const replay = option('replay') && path.resolve(option('replay'))
  if (replay) return await replay_run(replay, await read_run(replay))
  const report_only =
    option('report-only') && path.resolve(option('report-only'))
  if (report_only)
    return await print_report(report_only, await read_run(report_only))
  const judge_only = option('judge-only') && path.resolve(option('judge-only'))
  if (judge_only) {
    const saved = await read_run(judge_only)
    await judge_saved({ saved, out: judge_only, show_change: true })
    await save_run(judge_only, saved)
    return await print_report(judge_only, saved)
  }
  await run_eval({ model: option('model'), only: option('task') })
}

await run_entry(import.meta.url, main)
