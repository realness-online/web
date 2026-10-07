import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { describe, expect, it } from 'vitest'
import { get_item } from '@/utils/item'
import { is_vector } from '@/use/poster'
import {
  is_inline_poster_html,
  is_split_poster_html
} from '@/utils/poster-format'
const legacy_html = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../mocks/html/legacy-poster.html'
  ),
  'utf8'
)

const legacy_id = '/+16282281824/posters/1767138481392'

describe('legacy inline poster', () => {
  it('is detected as inline format', () => {
    expect(is_inline_poster_html(legacy_html)).toBe(true)
    expect(is_split_poster_html(legacy_html)).toBe(false)
  })

  it('parses shadow paths from pattern in defs', () => {
    const item = get_item(legacy_html, legacy_id)
    expect(item?.id).toBe(legacy_id)
    expect(item?.regular).toBeTruthy()
    expect(item?.light).toBeTruthy()
    expect(item?.medium).toBeTruthy()
    expect(item?.bold).toBeTruthy()
    expect(item?.background).toBeTruthy()
    expect(item?.viewbox).toBe('0 0 683 512')
    expect(is_vector(item)).toBe(true)
  })
})
