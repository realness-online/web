import { appendFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RUN_DONE, follow } from '../../../scripts/follow.js'

describe('follow', () => {
  it('prints each write as it lands and ends on the done line', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'follow-'))
    const file = join(dir, 'run.log')
    const printed = []
    const following = follow(file, RUN_DONE, text => {
      printed.push(text)
      if (printed.length === 1) appendFile(file, 'yc  12s  2 leads\n')
      if (printed.length === 2) appendFile(file, 'done 1 sources\n')
    })
    await appendFile(file, 'starting 1 sources, 1 at once\n')
    await following
    expect(printed.join('')).toBe(
      'starting 1 sources, 1 at once\nyc  12s  2 leads\ndone 1 sources\n'
    )
    await rm(dir, { recursive: true })
  })
})
