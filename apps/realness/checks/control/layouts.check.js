#!/usr/bin/env node
/**
 * The layout gate: every frame builds into a page that carries a title, a
 * byline, no empty figure, the site's PWA wiring, and readable text at a
 * phone's width.
 *
 * Builds a scratch site with one note per layout, checks the markup, then
 * opens each page in a browser and checks what a reader gets.
 */
import { execFile as exec_file } from 'node:child_process'
import { createReadStream as create_read_stream } from 'node:fs'
import { existsSync as exists_sync } from 'node:fs'
import {
  mkdir,
  mkdtemp,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { createServer as create_server } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(exec_file)
const here = dirname(file_url_to_path(import.meta.url))
const RENDERER = join(here, '../../tools/publish/renderer')
const GATE = join(here, '../../../../.pi/bin/checks/soundness-check.js')
const SCRATCH = join(here, '../../../../artifacts/realness/layouts-check')

const LAYOUTS = ['app', 'article', 'canvas', 'deck', 'print']
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json'
}
const CONTRAST_MIN = 4.5
const TARGET_MIN = 24
const NARROW = 320
const WIDE = 1280

const POSTER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#356e6e"/></svg>`

/** One note per layout, plus the site settings the build reads. */
const write_site = async root => {
  await mkdir(join(root, 'content/articles'), { recursive: true })
  await mkdir(join(root, 'static/posters'), { recursive: true })
  await write_file(
    join(root, 'site.json'),
    JSON.stringify({
      type: 'blog',
      name: 'Layout gate',
      tagline: 'Frames',
      description: 'Every frame, in one build',
      url: 'https://example.com',
      poster: 'poster.svg',
      pwa: true
    })
  )
  await write_file(join(root, 'static/posters/poster.svg'), POSTER)
  await Promise.all(
    LAYOUTS.map((layout, at) =>
      write_file(
        join(root, `content/articles/sample-${layout}.md`),
        [
          '---',
          `itemid: "/+14155551234/articles/${at + 1}"`,
          `title: "Frame ${layout}"`,
          `layout: ${layout}`,
          '---',
          '',
          ...(layout === 'canvas' ? [`# Frame ${layout}`, ''] : []),
          'A sentence in the note.',
          '',
          '## A heading',
          '',
          'Another sentence.'
        ].join('\n')
      )
    )
  )
}

/** Every way one page's markup can fail, as one list of lines. */
const faults_of = (layout, html) => {
  const faults = []
  const at = `/blog/sample-${layout}.html`
  const need = (fault, test) => {
    if (!test) faults.push(`${at}  ${fault}`)
  }
  need('no title', /<h1 itemprop="headline"/.test(html))
  need('empty figure', !/<figure/.test(html))
  need('no byline', /<address itemprop="author"/.test(html))
  need('no palette', /href="\/palette\.css"/.test(html))
  need('no manifest', /href="\/manifest\.webmanifest"/.test(html))
  need('no service worker', /src="\/scripts\/pwa\.js"/.test(html))
  if (layout === 'app')
    need(
      'app frame lost its site header',
      /\/partials\/header\.fragment/.test(html)
    )
  else need('site chrome in a bare frame', !/\/partials\//.test(html))
  if (layout === 'deck')
    need('no slide script', /\/layouts\/deck\.js/.test(html))
  return faults
}

/** The built-site gate's lines about the scratch pages. */
const gate_faults = async dist => {
  const { stdout } = await run(process.execPath, [GATE, '--site', dist], {
    maxBuffer: 10 * 1024 * 1024
  }).catch(error => ({ stdout: String(error.stdout ?? '') }))
  return stdout.split('\n').filter(line => line.includes('/blog/sample-'))
}

/** What a browser reports for one page: headings, contrast, targets, overflow. */
const AUDIT = `(() => {
  const oklch = text => {
    const parts = text.match(/oklch\\(([\\d.]+)%? ([\\d.]+) ([\\d.]+)/)
    if (!parts) return null
    const L = Number(parts[1]) > 1 ? Number(parts[1]) / 100 : Number(parts[1])
    const C = Number(parts[2])
    const H = (Number(parts[3]) * Math.PI) / 180
    const a = C * Math.cos(H)
    const b = C * Math.sin(H)
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b
    const s_ = L - 0.0894841775 * a - 1.291485548 * b
    const l = l_ ** 3
    const m = m_ ** 3
    const s = s_ ** 3
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ].map(v => Math.min(1, Math.max(0, v)))
  }
  const to_linear = c => {
    const value = Math.min(1, Math.max(0, c))
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  }
  const linear = value => {
    const text = String(value).trim()
    if (text.startsWith('oklch')) return oklch(text)
    const nums = (text.match(/[\\d.]+/g) || []).map(Number)
    if (!nums.length) return null
    const unit = text.startsWith('color(')
    return nums.slice(0, 3).map(v => to_linear(unit ? v : v / 255))
  }
  const luminance = rgb => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
  const behind = el => {
    let node = el
    while (node) {
      const style = getComputedStyle(node).backgroundColor
      const nums = (style.match(/[\\d.]+/g) || []).map(Number)
      const alpha = nums[3] === undefined ? 1 : Number(nums[3])
      if (nums.length > 2 && alpha > 0.5) {
        const rgb = linear(style)
        if (rgb) return rgb
      }
      node = node.parentElement
    }
    return null
  }
  const ratio = (one, two) => {
    const a = luminance(one)
    const b = luminance(two)
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10
  }
  const text_colors = el => {
    const style = getComputedStyle(el)
    const fill = style.webkitTextFillColor
    const clear = /rgba\\(0, 0, 0, 0\\)/.test(fill) || /transparent/.test(fill)
    if (!clear || !style.backgroundImage.includes('gradient'))
      return [linear(style.color)].filter(Boolean)
    const stops = style.backgroundImage.match(/(oklch|rgba?)\\([^)]*\\)/g) || []
    return stops.map(linear).filter(Boolean)
  }
  const shown = el => el.getClientRects().length > 0
  const samples = [
    ...document.querySelectorAll(
      'article[itemscope] p, article[itemscope] dd, article[itemscope] li, article[itemscope] h1, article[itemscope] h2, figcaption, address, main > header a, main > header small, nav a'
    )
  ].filter(shown).slice(0, 60)
  let contrast = null
  let worst = null
  for (const sample of samples) {
    const back = behind(sample)
    const values = text_colors(sample)
      .map(front => (front && back ? ratio(front, back) : null))
      .filter(value => value !== null)
    if (!values.length) continue
    const value = Math.min(...values)
    if (contrast === null || value < contrast) {
      contrast = value
      worst = sample.textContent.trim().slice(0, 24)
    }
  }
  const heads = [...document.querySelectorAll('h1,h2,h3')].filter(shown)
  return JSON.stringify({
    h1: heads.filter(head => head.tagName === 'H1').length,
    contrast,
    worst,
    small_targets: [...document.querySelectorAll('a,button')]
      .filter(shown)
      .filter(el => {
        const box = el.getBoundingClientRect()
        return box.width < ${TARGET_MIN} || box.height < ${TARGET_MIN}
      })
      .map(el => el.textContent.trim().slice(0, 24)),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  })
})()`

/** Serve a built folder, and stop when told. */
const serve = dist =>
  new Promise(done => {
    const server = create_server((request, response) => {
      const path = join(dist, decodeURIComponent(request.url.split('?')[0]))
      const file = path.endsWith('/') ? join(path, 'index.html') : path
      if (!exists_sync(file)) {
        response.writeHead(404).end()
        return
      }
      response.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream'
      })
      create_read_stream(file).pipe(response)
    })
    server.listen(0, '127.0.0.1', () =>
      done({ server, origin: `http://127.0.0.1:${server.address().port}` })
    )
  })

/** Drive one browser session over every page, at two widths. */
const audit = async browser => {
  const text = await browser('eval', AUDIT)
  const parsed = JSON.parse(text)
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed
}

const browser_faults = async (origin, session) => {
  const browser = (...args) =>
    run('agent-browser', ['--session', session, ...args], {
      maxBuffer: 10 * 1024 * 1024
    }).then(({ stdout }) => stdout.trim())
  const faults = []
  try {
    await browser('set', 'viewport', String(WIDE), '900')
    for (const layout of LAYOUTS) {
      await browser('open', `${origin}/blog/sample-${layout}.html`)
      const report = await audit(browser)
      const at = `/blog/sample-${layout}.html`
      if (report.h1 !== 1)
        faults.push(`${at}  ${report.h1} first-level headings`)
      if (report.contrast !== null && report.contrast < CONTRAST_MIN)
        faults.push(
          `${at}  text contrast ${report.contrast} at "${report.worst}"`
        )
      if (report.small_targets.length)
        faults.push(
          `${at}  targets under ${TARGET_MIN}px: ${report.small_targets.join(', ')}`
        )
      if (report.overflow > 0)
        faults.push(`${at}  overflows by ${report.overflow}px`)
      await browser('set', 'viewport', String(NARROW), '900')
      await browser('open', `${origin}/blog/sample-${layout}.html`)
      const narrow = await audit(browser)
      if (narrow.overflow > 0)
        faults.push(`${at}  overflows ${narrow.overflow}px at ${NARROW}`)
      await browser('set', 'viewport', String(WIDE), '900')
    }
  } finally {
    await browser('close').catch(() => {})
  }
  return faults
}

const main = async () => {
  await mkdir(SCRATCH, { recursive: true })
  const root = await mkdtemp(join(SCRATCH, 'site-'))
  let server = null
  try {
    await write_site(root)
    await run(process.execPath, [join(RENDERER, 'build.js')], { cwd: root })
    const dist = join(root, 'dist')
    const pages = await Promise.all(
      LAYOUTS.map(async layout => ({
        layout,
        html: await read_file(
          join(dist, 'blog', `sample-${layout}.html`),
          'utf8'
        )
      }))
    )
    const faults = pages.flatMap(({ layout, html }) => faults_of(layout, html))
    faults.push(...(await gate_faults(dist)))
    const served = await serve(dist)
    server = served.server
    faults.push(
      ...(await browser_faults(served.origin, `layouts-check-${process.pid}`))
    )
    if (faults.length) {
      for (const fault of faults) console.log(`  ${fault}`)
      console.log(`layouts: ${faults.length} fault(s)`)
      process.exit(1)
    }
    console.log(`layouts: ${LAYOUTS.length} frames clean`)
  } finally {
    server?.close()
    await rm(root, { recursive: true, force: true })
  }
}

if (process.argv[1] === file_url_to_path(import.meta.url)) await main()
