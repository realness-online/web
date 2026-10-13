import assert from 'node:assert/strict'
import { execFileSync as exec_file_sync } from 'node:child_process'
import {
  mkdir,
  readdir as read_directory,
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL as path_to_file_url } from 'node:url'
import { artifacts_dir } from './lib/artifacts.js'

/** Exercise the page/chat DOM contract with the shipped styles in headless Brave. */
const assets = new URL('../dist/assets/', import.meta.url)
const files = (await read_directory(assets)).filter(name =>
  name.endsWith('.css')
)
const css = (
  await Promise.all(files.map(name => read_file(new URL(name, assets), 'utf8')))
).join('\n')
const fixture = path.join(artifacts_dir, 'page-layout', 'fixture.html')
await mkdir(path.dirname(fixture), { recursive: true })
await write_file(
  fixture,
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>Page layout check</title><style>${css}</style><body><main id="realness"><section aria-label="Current page" tabindex="-1"></section><aside id="chat-panel" aria-label="Chat"></aside></main></body></html>`
)

const session = `page-layout-${process.pid}`
const browser = (...args) => {
  const output = JSON.parse(
    exec_file_sync('agent-browser', ['--session', session, '--json', ...args], {
      encoding: 'utf8'
    })
  )
  assert.equal(output.success, true, output.error)
  return output.data
}
const eval_layout = source => {
  const output = JSON.parse(
    exec_file_sync(
      'agent-browser',
      ['--session', session, '--json', 'eval', '--stdin'],
      { encoding: 'utf8', input: source }
    )
  )
  assert.equal(output.success, true, output.error)
  return output.data.result
}

const thoughts = `<section id="thoughts" data-page><header><button type="button" data-chat-toggle aria-label="Open chat"><svg viewBox="0 0 16 14"><path d="M2.5 1.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-3.5 2.5v-2.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" /></svg></button><a id="about" href="/about"><span>2</span><span>?</span><span>10</span><span>7</span></a></header><h1>Thoughts</h1><section data-days role="feed"><article><header><h4>Today</h4></header><article data-thought><p itemprop="statement">First thought</p></article><article data-thought><p itemprop="statement">Second thought</p></article></article></section></section>`
const docs =
  '<section id="docs" data-page><header><h1>Documentation</h1></header><article><nav aria-label="Table of contents"><a href="#overview">Overview</a><a href="#poster">Anatomy of a poster</a></nav><section itemprop="content"><h2 id="overview">Overview</h2><p>Realness is a rotoscoping tool. It traces a photo into a layered SVG poster.</p></section></article></section>'
const narrow_width = 800
const widths = Object.values({
  desktop: 1920,
  portrait_monitor: 1440,
  split_view_gate: 1280,
  narrow: 1024,
  tablet: narrow_width,
  phone: 390
})
const tolerance = 2

try {
  browser(
    '--executable-path',
    process.env.CHROME_PATH ??
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    'open',
    path_to_file_url(fixture).href
  )
  for (const width of widths) {
    browser('set', 'viewport', String(width), '900')
    for (const [name, markup] of [
      ['thoughts', thoughts],
      ['docs', docs]
    ])
      for (const open of [true, false]) {
        const result = eval_layout(`(() => {
          const page = document.querySelector('section[aria-label="Current page"]')
          page.innerHTML = ${JSON.stringify(markup)}
          const panel = document.querySelector('#chat-panel')
          const wide = matchMedia('(min-width: 80rem)').matches
          panel.toggleAttribute('data-open', ${open})
          panel.toggleAttribute('data-alone', !wide)
          const thoughts = document.querySelector('#thoughts')
          if (thoughts) thoughts.toggleAttribute('data-chat', ${open} && wide)
          document.getAnimations().forEach(animation => animation.finish())
          const content = document.querySelector('#thoughts section[data-days], #docs')
          const rect = content.getBoundingClientRect()
          const boundary = page.getBoundingClientRect()
          const panel_width = panel.getBoundingClientRect().width
          return { wide, left: rect.left, right: rect.right, width: rect.width,
             scroll: content.scrollWidth, page_right: boundary.right,
             expected_left: boundary.left + (${open} && wide ? panel_width : 0),
             docs_gate: 43 * parseFloat(getComputedStyle(document.documentElement).fontSize),
             docs_width: content.clientWidth - parseFloat(getComputedStyle(content).paddingLeft) - parseFloat(getComputedStyle(content).paddingRight),
             columns: getComputedStyle(content.querySelector(':scope > article') ?? content).gridTemplateColumns }
        })()`)
        const label = `${name}, ${width}px, chat ${open ? 'open' : 'closed'}`
        if (name === 'thoughts')
          assert.ok(
            Math.abs(result.left - result.expected_left) <= tolerance,
            `${label}: duplicate or missing chat offset: ${JSON.stringify(result)}`
          )
        assert.ok(
          result.left >= result.expected_left - tolerance,
          `${label}: content overlaps chat`
        )
        assert.ok(
          result.right <= result.page_right + tolerance,
          `${label}: page extends beyond its shell`
        )
        assert.ok(
          result.scroll <= result.width + tolerance,
          `${label}: content overflows: ${JSON.stringify(result)}`
        )
        if (name === 'docs')
          assert.equal(
            result.columns === 'none'
              ? 1
              : result.columns.trim().split(/\s+/).length,
            result.docs_width < result.docs_gate ? 1 : 2,
            `${label}: contents must follow the available docs width`
          )
        if (name === 'thoughts' && width <= narrow_width)
          assert.equal(
            result.columns.trim().split(/\s+/).length,
            1,
            `${label}: feed must collapse to one column`
          )
      }
  }
  browser('set', 'viewport', '1440', '900')
  const header = eval_layout(`(() => {
    document.querySelector('section[aria-label="Current page"]').innerHTML = ${JSON.stringify(thoughts)}
    const panel = document.querySelector('#chat-panel')
    panel.innerHTML = '<header><button type="button" itemprop="feed_filter"><svg viewBox="0 0 16 16"></svg></button><button type="button" data-side-toggle><svg viewBox="0 0 16 12"><rect x="0.75" y="0.75" width="14.5" height="10.5" rx="2" /></svg></button></header>'
    panel.setAttribute('data-open', '')
    panel.removeAttribute('data-alone')
    document.querySelector('#thoughts').setAttribute('data-chat', '')
    document.getAnimations().forEach(animation => animation.finish())
    const mark = document.querySelector('#about > span:nth-child(2)').getBoundingClientRect()
    const controls = [...document.querySelectorAll('[data-chat-toggle], [data-side-toggle], [itemprop="feed_filter"]')].map(button => {
      button.focus()
      const rect = button.getBoundingClientRect()
      return { center: rect.top + rect.height / 2, outline: getComputedStyle(button).outlineStyle }
    })
    return { center: mark.top + mark.height / 2, controls }
  })()`)
  for (const control of header.controls) {
    assert.equal(
      control.outline,
      'none',
      'Header icons must have no focus outline'
    )
    assert.ok(
      Math.abs(control.center - header.center) <= tolerance,
      'Header icons must align with the question mark'
    )
  }
  browser('screenshot', path.join(path.dirname(fixture), 'header-after.png'))
  console.info(
    'Page layout: Thoughts and documentation fit, chat open/closed, 390-1920px; header icons align without focus outlines'
  )
} finally {
  browser('close')
}
