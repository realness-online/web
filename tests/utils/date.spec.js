import { describe, it, expect, vi } from 'vite-plus/test'
import {
  time_of_day,
  as_day_time_of_day_for_filename,
  as_day_time_year,
  as_day,
  as_time,
  id_as_day
} from '@/utils/date'

vi.mock('@/utils/itemid', () => ({
  as_created_at: vi.fn(() => Date.parse('2020-06-15'))
}))

describe('@/utils/date', () => {
  it('time_of_day returns morning afternoon evening night', () => {
    expect(time_of_day(new Date('2024-01-01T08:00:00'))).toBe('morning')
    expect(time_of_day(new Date('2024-01-01T14:00:00'))).toBe('afternoon')
    expect(time_of_day(new Date('2024-01-01T19:00:00'))).toBe('evening')
    expect(time_of_day(new Date('2024-01-01T23:00:00'))).toBe('night')
  })

  it('as_day_time_of_day_for_filename includes weekday and period', () => {
    const label = as_day_time_of_day_for_filename(
      new Date('2024-01-01T14:00:00')
    )
    expect(label).toMatch(/afternoon/)
    expect(label).toMatch(/January/)
  })

  it('as_day_time_year formats full datetime', () => {
    const formatted = as_day_time_year(new Date('2024-01-01T14:30:00'))
    expect(formatted).toMatch(/2024/)
    expect(formatted).toMatch(/30/)
  })

  it('as_day returns Today for the current date', () => {
    expect(as_day(new Date())).toBe('Today')
  })

  it('as_day includes year for dates before this year', () => {
    expect(as_day(new Date('2019-06-15T12:00:00'))).toMatch(/2019/)
  })

  it('as_time formats clock time', () => {
    expect(as_time(new Date('2024-01-01T14:30:00'))).toMatch(/2:30/)
  })

  it('id_as_day formats created_at from itemid', () => {
    expect(id_as_day('/+1/posters/1720119797893')).toMatch(/2020/)
  })
})
