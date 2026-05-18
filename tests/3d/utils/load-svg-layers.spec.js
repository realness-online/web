import { vi } from 'vite-plus/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parse_poster_svg,
  parse_svg_layers,
  extract_layer_svg,
  extract_symbol_child_svg,
  extract_symbol_child_from_context
} from '@/3d/utils/load-svg-layers.js'

vi.mock('three/addons/loaders/SVGLoader.js', () => ({
  SVGLoader: class {
    parse() {
      return { paths: [{ id: 'path' }] }
    }
  }
}))

const fixture_dir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const poster_svg = readFileSync(join(fixture_dir, 'poster-layers.svg'), 'utf8')

describe('load_svg_layers', () => {
  describe('parse_svg_layers', () => {
    it('parses named symbols into layer paths', () => {
      const result = parse_svg_layers(poster_svg, [
        'boulders',
        'rocks',
        'missing'
      ])

      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
      expect(result.layers.map(layer => layer.name)).toEqual([
        'boulders',
        'rocks'
      ])
      expect(result.layers[0].paths.length).toBeGreaterThan(0)
    })
  })

  describe('extract_layer_svg', () => {
    it('returns standalone svg with defs and use', () => {
      const layer_svg = extract_layer_svg(poster_svg, 'boulders')

      expect(layer_svg).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(layer_svg).toContain('<defs>')
      expect(layer_svg).toContain('href="#boulders"')
      expect(layer_svg).not.toContain('symbol id="rocks"')
    })
  })

  describe('parse_poster_svg', () => {
    it('reuses one parse for multiple shadow extractions', () => {
      const parsed = parse_poster_svg(poster_svg)
      const bold = extract_symbol_child_from_context(parsed, 'shadows', 'bold')
      const light = extract_symbol_child_from_context(
        parsed,
        'shadows',
        'light'
      )

      expect(bold).toContain('id="bold"')
      expect(light).toContain('id="light"')
    })
  })

  describe('extract_symbol_child_svg', () => {
    it('returns child markup inside symbol with defs', () => {
      const child_svg = extract_symbol_child_svg(poster_svg, 'shadows', 'bold')

      expect(child_svg).toContain('<defs>')
      expect(child_svg).toContain('id="bold"')
    })

    it('returns null when symbol or child is missing', () => {
      expect(extract_symbol_child_svg(poster_svg, 'nope', 'bold')).toBeNull()
      expect(extract_symbol_child_svg(poster_svg, 'shadows', 'nope')).toBeNull()
    })
  })
})
