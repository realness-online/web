import { describe, it, expect } from 'vite-plus/test'
import {
  as_iso_day,
  as_month_day,
  sanitize_path_segment,
  thought_snippet,
  thought_folder_name,
  thought_folder_path,
  poster_file_name
} from '@/utils/folder-sync-paths'

const author = '/+14151234356'

describe('@/utils/folder-sync-paths', () => {
  it('formats a local ISO day', () => {
    expect(as_iso_day(new Date(2026, 6, 18, 15))).toBe('2026-07-18')
  })

  it('formats a local month and day', () => {
    expect(as_month_day(new Date(2026, 6, 18, 15))).toBe('07-18')
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

  it('names a thought folder with month day, weekday, period, and snippet', () => {
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
    expect(name).toBe('07-18 Saturday morning — walking to the café')
  })

  it('omits the em dash when there is no snippet', () => {
    const started = new Date(2026, 6, 18, 21, 0).getTime()
    const name = thought_folder_name({
      author_id: author,
      started_at: started,
      posters: [{ id: `${author}/posters/${started}`, type: 'posters' }],
      statements: []
    })
    expect(name).toBe('07-18 Saturday evening')
  })

  describe('thought_folder_path', () => {
    const thought_at = started => ({
      author_id: author,
      started_at: started,
      posters: [],
      statements: []
    })
    const now = new Date(2026, 6, 18, 12).getTime()

    // The year you are still working in should not cost a click to reach.
    it('keeps this year at the root', () => {
      const started = new Date(2026, 0, 4, 9).getTime()
      expect(thought_folder_path(thought_at(started), now)).toBe(
        '01-04 Sunday morning'
      )
    })

    it('files every older year under its own folder', () => {
      const started = new Date(2019, 11, 8, 8).getTime()
      expect(thought_folder_path(thought_at(started), now)).toBe(
        '2019/12-08 Sunday morning'
      )
    })

    it('rolls last year into a folder once the year turns', () => {
      const started = new Date(2026, 11, 30, 9).getTime()
      const next_year = new Date(2027, 0, 2, 12).getTime()
      expect(thought_folder_path(thought_at(started), next_year)).toBe(
        '2026/12-30 Wednesday morning'
      )
    })
  })

  it('names poster files by day, period, and clock time', () => {
    const created = new Date(2026, 6, 18, 9, 30).getTime()
    expect(poster_file_name(`${author}/posters/${created}`)).toBe(
      '2026-07-18 morning 0930.svg'
    )
  })
})
