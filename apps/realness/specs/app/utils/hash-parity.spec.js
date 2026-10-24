import { describe, it, expect } from 'vite-plus/test'
import { create_hash } from '@/utils/upload-processor'

describe('hash parity with the ops repair tool', () => {
  it('is base64 sha256 of the html string', async () => {
    expect(await create_hash('hello')).toBe(
      'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
    )
  })
})
