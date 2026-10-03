import { describe, it, expect, vi } from 'vite-plus/test'
import {
  fetch_print_pages,
  print_pages_from_list,
  sale_line
} from '../../scripts/print-pages.js'

const print = (overrides = {}) => ({
  id: '1712000000000',
  image: 'https://storage.example/print.png?token=abc',
  thought: 'the harbor at first light',
  dates: ['2026-09-22T02:42:22Z'],
  ...overrides
})

describe('scripts/print-pages', () => {
  it('gives each print its own address, image, and description', () => {
    const pages = print_pages_from_list({ prints: [print()] })

    expect(pages).toHaveLength(1)
    expect(pages[0].path).toBe('/prints/1712000000000')
    expect(pages[0].title).toBe('Hand-finished print - Realness Online')
    expect(pages[0].og_title).toBe('Hand-finished print - Realness Online')
    expect(pages[0].og_image).toBe(
      'https://storage.example/print.png?token=abc'
    )
    expect(pages[0].description).toBe(
      'the harbor at first light - Recorded sale date: 2026-09-22'
    )
  })

  it('describes an unsold print by its thought alone', () => {
    const pages = print_pages_from_list({
      prints: [print({ dates: [], image: null })]
    })

    expect(pages[0].description).toBe(
      'the harbor at first light - No sales recorded yet.'
    )
    expect(pages[0].og_image).toBeUndefined()
  })

  it('lists several sale dates in one line', () => {
    expect(sale_line(['2026-01-02T00:00:00Z', '2026-02-03T00:00:00Z'])).toBe(
      'Recorded sale dates: 2026-01-02, 2026-02-03'
    )
  })

  it('skips an entry without a usable id', () => {
    const pages = print_pages_from_list({
      prints: [print({ id: 'not-a-stamp' }), print({ id: '1712000000001' })]
    })

    expect(pages.map(page => page.path)).toEqual(['/prints/1712000000001'])
  })

  it('answers nothing for an unexpected body', () => {
    expect(print_pages_from_list(null)).toEqual([])
    expect(print_pages_from_list({ prints: 'nope' })).toEqual([])
  })

  it('reads the list from the shop', async () => {
    const fetch_json = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prints: [print()] })
    }))

    const pages = await fetch_print_pages(
      'https://realness.online/prints-list',
      fetch_json
    )

    expect(fetch_json).toHaveBeenCalledWith(
      'https://realness.online/prints-list'
    )
    expect(pages).toHaveLength(1)
  })

  it('builds without print pages when the shop cannot be reached', async () => {
    const log = vi.fn()
    const failing = vi.fn(async () => {
      throw new Error('offline')
    })

    expect(
      await fetch_print_pages('https://example/prints-list', failing, log)
    ).toEqual([])
    expect(log).toHaveBeenCalledWith('prerender: no print pages (offline)')

    const refusing = vi.fn(async () => ({ ok: false, status: 502 }))
    expect(
      await fetch_print_pages('https://example/prints-list', refusing, log)
    ).toEqual([])
    expect(await fetch_print_pages(undefined, failing, log)).toEqual([])
  })
})
