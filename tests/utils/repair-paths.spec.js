import { describe, it, expect } from 'vite-plus/test'
import { as_filename } from '@/utils/itemid'

describe('storage paths a repair tool has to write', () => {
  it('names the profile and the statements file', async () => {
    expect(await as_filename('/+14155550101')).toBe(
      'people/+14155550101/index.html.gz'
    )
    expect(await as_filename('/+14155550101/statements')).toBe(
      'people/+14155550101/statements/index.html.gz'
    )
  })
})
