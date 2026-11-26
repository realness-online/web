import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vite-plus/test'
import { EXPLORER_ROLE, explorer_instructions } from '@/utils/explorer-brief'

const harness = path => readFileSync(resolve('../..', path), 'utf8')

describe('explorer-brief', () => {
  it("p1: chat's first message carries the harness rules and the planning and vault skills", () => {
    const brief = explorer_instructions()
    expect(brief.startsWith(EXPLORER_ROLE)).toBe(true)
    expect(brief).toContain(harness('.pi/agent/APPEND_SYSTEM.md').trim())
    expect(brief).toContain(harness('.pi/skills/planning/SKILL.md').trim())
    expect(brief).toContain(harness('.pi/skills/vault/SKILL.md').trim())
    expect(brief).toContain('Plan work as a directed acyclic graph')
  })
})
