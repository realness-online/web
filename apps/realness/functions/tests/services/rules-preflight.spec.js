import { existsSync, readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { rules_protect_both, released_storage_rules } from '#services/rules-preflight.js'

const app_rules = new URL('../../../../realness/storage.rules', import.meta.url)

describe('rules_protect_both', () => {
  it.skipIf(!existsSync(app_rules))('accepts the realness rules that guard both private names', () => {
    expect(rules_protect_both(readFileSync(app_rules, 'utf8'))).toBe(true)
  })

  it('rejects the rules production ran before the migration', () => {
    const before = `match /relations.html.gz { allow read, write, delete: if owns(mobile); }
      match /{file} { allow get: if file != 'relations.html.gz'; }`
    expect(rules_protect_both(before)).toBe(false)
  })

  it('rejects empty or unrelated rules', () => {
    expect(rules_protect_both('')).toBe(false)
    expect(rules_protect_both("match /{file} { allow get: if true; }")).toBe(false)
  })
})

describe('released_storage_rules', () => {
  it('reads the ruleset released for the bucket', async () => {
    const fetch_json = vi.fn(async url => url.includes('/releases/')
      ? { rulesetName: 'projects/p/rulesets/abc' }
      : { source: { files: [{ content: 'one' }, { content: 'two' }] } })
    expect(await released_storage_rules({ project: 'p', bucket_name: 'p.appspot.com', fetch_json }))
      .toBe('one\ntwo')
    expect(fetch_json.mock.calls[0][0]).toBe(
      'https://firebaserules.googleapis.com/v1/projects/p/releases/firebase.storage/p.appspot.com'
    )
  })

  it('fails closed with no release', async () => {
    await expect(released_storage_rules({
      project: 'p', bucket_name: 'b', fetch_json: async () => ({})
    })).rejects.toThrow('No storage rules')
  })
})
