import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../../scripts/lib/artifacts.js'
import {
  check_interaction_css,
  main
} from '../../../scripts/check-interaction-css.js'

const good = [
  'aside#chat-panel{z-index:2}',
  'section#tui-pane{z-index:3}',
  'dialog[data-key-panel]{z-index:9}',
  'section[aria-label="Current page"]{inline-size:100%}',
  'p{-webkit-user-select:text}',
  '[itemprop=statement]:not([contenteditable=true]){-webkit-user-select:none}',
  'a{-webkit-touch-callout:none}',
  'aside#chat-panel>aside{min-block-size:3rem}',
  ':focus-visible{outline:2px solid var(--emphasis)}',
  'section[aria-label="Current page"]:focus-visible{outline:none}',
  'aside#fps{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto minmax(0,1fr) auto}'
].join('')

const without = (rule, replacement = '') => good.replace(rule, replacement)

describe('check-interaction-css', () => {
  it('accepts CSS that keeps every rule', () => {
    expect(() => check_interaction_css(good)).not.toThrow()
  })

  it.each([
    ['inline-size:100%', 'current page full-width'],
    ['-webkit-user-select:text', 'Safari text selection'],
    ['-webkit-touch-callout:none', 'touch callout'],
    ['min-block-size:3rem', 'reserve height'],
    ['solid var(--emphasis)', 'emphasis color'],
    [':focus-visible{outline:none}', 'whole-page ring'],
    ['display:grid;', 'lay out readouts'],
    ['dialog[data-key-panel]{z-index:9}', 'dialog\\[data-key-panel\\]'],
    ['section#tui-pane{z-index:3}', 'section#tui-pane']
  ])('rejects CSS missing %s', (rule, message) => {
    expect(() => check_interaction_css(without(rule))).toThrow(
      new RegExp(message)
    )
  })

  it('rejects a rule without a layer', () => {
    expect(() =>
      check_interaction_css(without('{z-index:9}', '{color:red}'))
    ).toThrow(/set a layer/)
  })

  it('rejects a keyboard below the chat', () => {
    expect(() =>
      check_interaction_css(without('{z-index:9}', '{z-index:1}'))
    ).toThrow(/Keyboard must appear above aside#chat-panel/)
  })

  it('rejects info with its own background', () => {
    expect(() =>
      check_interaction_css(without('aside#fps{', 'aside#fps{background:red;'))
    ).toThrow(/tray surface/)
  })

  it('rejects hiding info in short trays', () => {
    expect(() =>
      check_interaction_css(
        `${good}@container chat-buffer (height < 4.5rem){aside#fps{display:none}}`
      )
    ).toThrow(/compact info visible/)
  })

  it('rejects CSS without the info panel', () => {
    expect(() =>
      check_interaction_css(good.replace(/aside#fps\{[^}]*\}/, ''))
    ).toThrow(/info panel/)
  })

  describe('main', () => {
    let dist
    afterEach(() => {
      delete process.env.DIST_DIR
      rmSync(dist, { recursive: true, force: true })
      vi.restoreAllMocks()
    })

    it('reads every stylesheet in the built assets', async () => {
      mkdirSync(artifacts_dir, { recursive: true })
      dist = mkdtempSync(path.join(artifacts_dir, 'interaction-css-'))
      mkdirSync(path.join(dist, 'assets'))
      const half = good.indexOf('a{')
      writeFileSync(path.join(dist, 'assets', 'a.css'), good.slice(0, half))
      writeFileSync(path.join(dist, 'assets', 'b.css'), good.slice(half))
      writeFileSync(path.join(dist, 'assets', 'c.js'), 'ignored')
      process.env.DIST_DIR = dist
      vi.spyOn(console, 'info').mockImplementation(() => {})
      await main()
      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(/Interaction CSS/)
      )
    })
  })
})
