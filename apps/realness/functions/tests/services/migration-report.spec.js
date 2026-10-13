import { describe, it, expect } from 'vitest'
import { migration_report } from '#services/migration-report.js'

const source = {
  name: 'people/+1/relations.html.gz', generation: '90071992547409931',
  md5Hash: 'bytes', size: '100', contentType: 'text/html', contentEncoding: 'gzip',
  metadata: { firebaseStorageDownloadTokens: 'private-token', hash: 'html', sold: 'true' }
}
const target = {
  ...source, name: 'people/+1/relations.html', generation: '90071992547409932'
}

describe('migration_report', () => {
  it('plans missing counterparts with an absence precondition', () => {
    expect(migration_report([source])).toEqual([{
      source: source.name, target: target.name,
      source_generation: source.generation, target_generation: '0', status: 'copy'
    }])
  })

  it('reports equivalent copies without leaking private metadata', () => {
    const report = migration_report([source, target])
    expect(report[0].status).toBe('matched')
    expect(JSON.stringify(report)).not.toContain('private-token')
  })

  it.each([
    { md5Hash: 'different' },
    { contentEncoding: 'deflate' },
    { metadata: { hash: 'html' } },
    { cacheControl: 'public' },
    { size: '101' }
  ])('does not overwrite a conflicting counterpart: %j', override => {
    expect(migration_report([source, { ...target, ...override }])[0].status).toBe('conflict')
  })

  it('does not trust objects lacking a content checksum or generation', () => {
    expect(migration_report([{ ...source, md5Hash: undefined }])[0].status).toBe('unverified')
    expect(migration_report([{ ...source, generation: undefined }])[0].status).toBe('unverified')
  })

  it('ignores unrelated objects and new-only files', () => {
    expect(migration_report([target, { name: 'other/a.html.gz' }])).toEqual([])
  })

  it('does not modify the supplied listing', () => {
    const listing = [Object.freeze(source), Object.freeze(target)]
    migration_report(Object.freeze(listing))
    expect(listing).toEqual([source, target])
  })
})
