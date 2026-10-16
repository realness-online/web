import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../scripts/lib/artifacts.js'
import { main, report_commands } from '../../scripts/quality-report.js'

let reports
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  reports = path.join(
    mkdtempSync(path.join(artifacts_dir, 'quality-')),
    'reports'
  )
})
afterEach(() => rmSync(path.dirname(reports), { recursive: true, force: true }))

describe('report_commands', () => {
  it('points every report at the coverage file', () => {
    const commands = report_commands(reports)
    expect(Object.keys(commands)).toEqual(['fallow', 'risk', 'coverage'])
    for (const command of Object.values(commands))
      expect(command).toContain(
        path.join(reports, 'coverage/coverage-final.json')
      )
    expect(commands.risk).toContain(path.join(reports, 'fallow-report.json'))
  })
})

describe('quality-report main', () => {
  it('rejects an unknown mode', () => {
    expect(() => main({ mode: 'nope', reports })).toThrow(
      'Unknown report: nope'
    )
  })

  it('saves fallow output to a file', () => {
    const run = vi.fn((command, args, { stdio }) => {
      expect(typeof stdio[1]).toBe('number')
      return { status: 0 }
    })
    expect(main({ mode: 'fallow', reports, run })).toBe(0)
    expect(readFileSync(path.join(reports, 'fallow-report.json'), 'utf8')).toBe(
      ''
    )
  })

  it('prints other reports and passes the status through', () => {
    const run = vi.fn(() => ({ status: null }))
    expect(main({ mode: 'coverage', reports, run })).toBe(1)
    expect(run.mock.calls[0][2].stdio[1]).toBe('inherit')
  })

  it('throws when the command cannot start', () => {
    const run = () => ({ error: new Error('ENOENT') })
    expect(() => main({ mode: 'risk', reports, run })).toThrow('ENOENT')
  })
})
