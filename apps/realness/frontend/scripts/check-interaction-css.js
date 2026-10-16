import assert from 'node:assert/strict'
import { read_built_css } from './lib/built-css.js'
import { run_entry } from './lib/entry.js'

/**
 * Assert the interaction rules the built CSS must keep.
 * @param {string} css
 */
export const check_interaction_css = css => {
  assert.match(
    css,
    /section\[aria-label=(?:["']Current page["']|Current\\ page)\]\{[^}]*inline-size:100%/,
    'Built CSS must keep the current page full-width inside the centered app shell'
  )

  assert.match(
    css,
    /-webkit-user-select:text/,
    'Built CSS must retain Safari text selection in editors'
  )
  assert.match(
    css,
    /\[itemprop=['"]?statement['"]?\]:not\(\[contenteditable=['"]?true['"]?\]\)\{[^}]*-webkit-user-select:none/,
    'Built CSS must suppress Safari selection on resting touch statements'
  )
  assert.match(
    css,
    /-webkit-touch-callout:none/,
    'Built CSS must retain touch callout suppression'
  )
  assert.match(
    css,
    /aside#chat-panel>aside\{[^}]*min-block-size:(?:calc\()?[^;}]*[1-9]/,
    'Chat tray must reserve height below the input'
  )
  assert.doesNotMatch(
    css,
    /@container chat-buffer\s*\(height\s*<\s*4\.5rem\)\s*\{aside#fps\{display:none/,
    'Short chat trays must keep compact info visible'
  )

  assert.match(
    css,
    /(?:^|\}):focus-visible\{[^}]*outline:[^;}]*solid var\(--emphasis\)/,
    'Global keyboard focus must use the app emphasis color'
  )
  assert.match(
    css,
    /section\[aria-label=(?:["']Current page["']|Current\\ page)\]:focus-visible\{[^}]*outline:(?:none|0)/,
    'Restoring focus to the page container must not draw a whole-page ring'
  )

  const info_rule = [...css.matchAll(/aside#fps\{([^}]+)\}/g)]
    .map(match => match[1])
    .join(';')
  assert.ok(info_rule, 'Built CSS must include the info panel')
  assert.ok(
    !/background:|text-shadow:/.test(info_rule),
    'Info must use the tray surface'
  )
  assert.match(
    info_rule,
    /display:grid/,
    'Info must lay out readouts across the tray'
  )
  assert.match(
    info_rule,
    /grid-template-columns:auto minmax\(0,1fr\) auto auto minmax\(0,1fr\) auto/,
    'Info must use equal meter columns with consistent gaps'
  )

  const layer_of = selector => {
    const rule = css
      .split('}')
      .find(rule => rule.split('{')[0].includes(selector))
    assert.ok(rule, `Built CSS must include ${selector}`)
    const layer = rule
      .split('{')
      .at(-1)
      .match(/z-index:(\d+)/)
    assert.ok(layer, `Built CSS must set a layer for ${selector}`)
    return Number(layer[1])
  }

  const keyboard_layer = layer_of('dialog[data-key-panel]')
  for (const selector of ['aside#chat-panel', 'section#tui-pane'])
    assert.ok(
      keyboard_layer > layer_of(selector),
      `Keyboard must appear above ${selector}`
    )
}

/** Check the built site's CSS. */
export const main = async () => {
  check_interaction_css(await read_built_css())
  console.info(
    'Interaction CSS: Safari selection, touch callout, and keyboard layers checked'
  )
}

await run_entry(import.meta.url, main)
