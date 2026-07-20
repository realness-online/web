import { describe, it, expect } from 'vite-plus/test'
import {
  as_iso_day,
  sanitize_path_segment,
  thought_snippet,
  thought_folder_name,
  poster_file_name
} from '@/utils/folder-sync-paths'

const author = '/+14151234356'

describe('@/utils/folder-sync-paths', () => {
  it('formats a local ISO day', () => {
    expect(as_iso_day(new Date(2026, 6, 18, 15))).toBe('2026-07-18')
  })

  it('sanitizes path-hostile characters', () => {
    expect(sanitize_path_segment('a/b:c*d')).toBe('a b c d')
  })

  it('builds a short snippet from the first statement line', () => {
    expect(
      thought_snippet([
        {
          id: `${author}/statements/1`,
          statement: 'walking to the café\nmore'
        }
      ])
    ).toBe('walking to the café')
  })

  it('names a thought folder with date, period, and snippet', () => {
    const started = new Date(2026, 6, 18, 9, 30).getTime()
    const name = thought_folder_name({
      author_id: author,
      started_at: started,
      posters: [],
      statements: [
        {
          id: `${author}/statements/${started}`,
          statement: 'walking to the café'
        }
      ]
    })
    expect(name).toBe('2026-07-18 morning — walking to the café')
  })

  it('omits the em dash when there is no snippet', () => {
    const started = new Date(2026, 6, 18, 21, 0).getTime()
    const name = thought_folder_name({
      author_id: author,
      started_at: started,
      posters: [{ id: `${author}/posters/${started}`, type: 'posters' }],
      statements: []
    })
    expect(name).toBe('2026-07-18 evening')
  })

  it('names poster files by day, period, and clock time', () => {
    const created = new Date(2026, 6, 18, 9, 30).getTime()
    expect(poster_file_name(`${author}/posters/${created}`)).toBe(
      '2026-07-18 morning 0930.svg'
    )
  })
})
