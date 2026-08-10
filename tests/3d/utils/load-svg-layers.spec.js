import { vi } from 'vite-plus/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parse_poster_svg,
  parse_svg_layers,
  extract_layer_svg,
  extract_symbol_child_svg,
  extract_symbol_child_from_context,
  extract_symbol_child_fill_from_context,
  extract_symbol_child_mask_from_context,
  extract_symbol_child_paint_from_context,
  extract_symbol_child_stroke_from_context
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

  describe('fill and stroke extraction', () => {
    it('strips stroke from fill-only shadow svg', () => {
      const parsed = parse_poster_svg(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
          <symbol id="shadows">
            <path id="bold" d="M0 0 L1 1" fill="#000" stroke="#fff" stroke-width="2" />
          </symbol>
        </svg>`
      )
      const fill_svg = extract_symbol_child_fill_from_context(
        parsed,
        'shadows',
        'bold'
      )

      expect(fill_svg).toContain('fill="#000"')
      expect(fill_svg).toContain('stroke="none"')
      expect(fill_svg).toContain('stroke-width="0"')
    })

    it('strips fill from stroke-only shadow svg', () => {
      const parsed = parse_poster_svg(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
          <symbol id="shadows">
            <path id="bold" d="M0 0 L1 1" fill="#000" stroke="#fff" stroke-width="2" />
          </symbol>
        </svg>`
      )
      const stroke_svg = extract_symbol_child_stroke_from_context(
        parsed,
        'shadows',
        'bold'
      )

      expect(stroke_svg).toContain('fill="none"')
      expect(stroke_svg).toContain('stroke="#fff"')
      expect(stroke_svg).toContain('stroke-opacity="0.90"')
    })
  })

  describe('mask and paint extraction', () => {
    const gradient_poster = () =>
      parse_poster_svg(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20">
          <defs><linearGradient id="grad"><stop offset="0" stop-color="#f00" /></linearGradient></defs>
          <symbol id="shadows">
            <path id="bold" d="M0 0 L1 1" fill="url(#grad)" fill-opacity="0.90" stroke="#fff" stroke-dasharray="4, 8" />
            <path id="flat" d="M0 0 L1 1" fill="#123456" />
          </symbol>
        </svg>`
      )

    it('paints the layer shape white and drops its stroke for the mask', () => {
      const mask_svg = extract_symbol_child_mask_from_context(
        gradient_poster(),
        'shadows',
        'bold'
      )

      expect(mask_svg).toContain('fill="#fff"')
      expect(mask_svg).toContain('stroke="none"')
      expect(mask_svg).not.toContain('stroke-dasharray')
    })

    it('keeps the source fill-opacity so the mask carries coverage', () => {
      const mask_svg = extract_symbol_child_mask_from_context(
        gradient_poster(),
        'shadows',
        'bold'
      )

      expect(mask_svg).toContain('fill-opacity="0.90"')
    })

    it('paints the gradient across the whole poster', () => {
      const paint_svg = extract_symbol_child_paint_from_context(
        gradient_poster(),
        'shadows',
        'bold'
      )

      expect(paint_svg).toContain('<defs>')
      expect(paint_svg).toContain('fill="url(#grad)"')
      expect(paint_svg).toContain('width="10"')
      expect(paint_svg).toContain('height="20"')
      expect(paint_svg).not.toContain('id="bold"')
    })

    it('returns no paint for a flat fill or a missing layer', () => {
      const parsed = gradient_poster()

      expect(
        extract_symbol_child_paint_from_context(parsed, 'shadows', 'flat')
      ).toBeNull()
      expect(
        extract_symbol_child_paint_from_context(parsed, 'shadows', 'nope')
      ).toBeNull()
      expect(
        extract_symbol_child_mask_from_context(parsed, 'shadows', 'nope')
      ).toBeNull()
    })
  })
})
