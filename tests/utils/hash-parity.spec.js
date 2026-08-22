import { describe, it, expect } from 'vite-plus/test'
import { create_hash } from '@/utils/upload-processor'

describe('hash parity with the ops repair tool', () => {
  // realness-ops/tools/repair-people.js writes files this app has to agree with.
  // It computes createHash('sha256').update(html).digest('base64'). If these two
  // ever diverge, repaired files mismatch on every sync tick, in silence.
  it('is base64 sha256 of the html string', async () => {
    expect(await create_hash('hello')).toBe(
      'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
    )
  })
})
