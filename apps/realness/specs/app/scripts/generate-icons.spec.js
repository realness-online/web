import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { artifacts_dir } from '../../../scripts/lib/artifacts.js'
import {
  extract_realness_symbol,
  main,
  replace_oklch_with_rgb
} from '../../../scripts/generate-icons.js'

const frontend = path.join(import.meta.dirname, '../../..')
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

describe('extract_realness_symbol', () => {
  it('reads the symbol, its viewBox, and shared defs', () => {
    const svg =
      '<defs id="fills"><a/></defs><defs id="tile-shapes"><b/></defs><symbol id="realness" viewBox="-1 -2 30 40"><path/></symbol>'
    expect(extract_realness_symbol(svg)).toEqual({
      symbol_content: '<path/>',
      fills_defs: '<defs id="fills"><a/></defs>',
      shapes_defs: '<defs id="tile-shapes"><b/></defs>',
      symbol_viewbox: { x: -1, y: -2, width: 30, height: 40 }
    })
  })

  it('allows missing defs', () => {
    const found = extract_realness_symbol(
      '<symbol id="realness" viewBox="0 0 1 1"></symbol>'
    )
    expect(found.fills_defs).toBe('')
    expect(found.shapes_defs).toBe('')
  })

  it('fails without the symbol', () => {
    expect(() => extract_realness_symbol('<svg/>')).toThrow(
      /Could not find realness symbol/
    )
  })
})

describe('replace_oklch_with_rgb', () => {
  it('turns oklch colors into rgb', () => {
    expect(replace_oklch_with_rgb('fill="oklch(1 0 0)"')).toMatch(
      /^fill="rgb\(\d+, \d+, \d+\)"$/
    )
  })
})

describe('main', () => {
  let public_dir
  beforeEach(() => {
    mkdirSync(artifacts_dir, { recursive: true })
    public_dir = mkdtempSync(path.join(artifacts_dir, 'icons-'))
    copyFileSync(
      path.join(frontend, 'public', 'icons.svg'),
      path.join(public_dir, 'icons.svg')
    )
  })
  afterEach(() => rmSync(public_dir, { recursive: true, force: true }))

  it('draws both icon sizes, drops stale icons, and copies docs', async () => {
    writeFileSync(path.join(public_dir, '180.png'), 'old')
    const documentation_md = path.join(public_dir, 'docs-source.md')
    writeFileSync(documentation_md, '# Docs\n')
    await main({ public_dir, documentation_md })
    for (const size of [192, 512]) {
      const icon = readFileSync(path.join(public_dir, `${size}.png`))
      expect(icon.subarray(0, 4)).toEqual(png)
      expect(icon.readUInt32BE(16)).toBe(size)
    }
    expect(existsSync(path.join(public_dir, '180.png'))).toBe(false)
    expect(
      readFileSync(path.join(public_dir, 'documentation.md'), 'utf8')
    ).toBe('# Docs\n')
  })
})
