import { describe, it, expect } from 'vitest'
import { gunzipSync } from 'node:zlib'
import {
  content_hash,
  profile_html,
  statements_html,
  paths_for,
  compress,
  metadata_for,
  missing_for,
  e64_from_prefix,
  parse_args
} from '../../../tools/ops/repair-people.js'

describe('tools/repair-people', () => {
  const e64 = '+14155550101'

  describe('content_hash', () => {
    it('matches what the browser computes', () => {
      expect(content_hash('hello')).toBe(
        'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
      )
    })

    it('hashes the html, not the compressed bytes', () => {
      const html = profile_html(e64)
      expect(content_hash(html)).not.toBe(content_hash(compress(html).toString()))
    })
  })

  describe('the files it writes', () => {
    it('addresses the profile to the person', () => {
      expect(profile_html(e64)).toContain('itemid="/+14155550101"')
      expect(profile_html(e64)).toContain('itemtype="/person"')
      expect(profile_html(e64)).toContain('itemprop="name"')
    })

    it('writes statements as an empty feed', () => {
      expect(statements_html(e64)).toContain('itemid="/+14155550101/statements"')
      expect(statements_html(e64)).toMatch(/><\/section>$/)
    })

    it('puts them where the app looks', () => {
      expect(paths_for(e64)).toEqual({
        profile: 'people/+14155550101/index.html',
        statements: 'people/+14155550101/statements/index.html'
      })
    })

    it('compresses so the app can inflate it back', () => {
      const html = statements_html(e64)
      expect(gunzipSync(compress(html)).toString('utf8')).toBe(html)
    })

    it('declares the encoding the bytes actually use', () => {
      const meta = metadata_for(profile_html(e64))
      expect(meta['Content-Encoding']).toBe('gzip')
      expect(meta['Content-Type']).toBe('text/html; charset=utf-8')
      expect(meta.hash).toBe(content_hash(profile_html(e64)))
    })
  })

  describe('deciding who needs repair', () => {
    it('spots each file independently', () => {
      expect(missing_for(e64, [])).toEqual({
        e64,
        profile: true,
        statements: true
      })
      expect(
        missing_for(e64, ['people/+14155550101/index.html.gz'])
      ).toMatchObject({ profile: false, statements: true })
      expect(
        missing_for(e64, [
          'people/+14155550101/index.html.gz',
          'people/+14155550101/statements/index.html.gz'
        ])
      ).toMatchObject({ profile: false, statements: false })
    })

    it('counts new names and mixed names as present', () => {
      expect(
        missing_for(e64, [
          'people/+14155550101/index.html',
          'people/+14155550101/statements/index.html.gz'
        ])
      ).toMatchObject({ profile: false, statements: false })
    })

    it('does not mistake a lookalike for the file', () => {
      expect(
        missing_for(e64, ['people/+14155550101/index.html.gzip'])
      ).toMatchObject({ profile: true })
    })

    it('is not fooled by a statements folder with no file in it', () => {
      expect(
        missing_for(e64, [
          'people/+14155550101/index.html.gz',
          'people/+14155550101/statements/'
        ])
      ).toMatchObject({ statements: true })
    })

    it('refuses a number it could write to the wrong path', () => {
      expect(() => parse_args(['--only', '14155550101'])).toThrow(/E.164/)
      expect(parse_args(['--only', '+14155550101']).only).toEqual([
        '+14155550101'
      ])
    })

    it('reports rather than writes unless told otherwise', () => {
      expect(parse_args([]).write).toBe(false)
      expect(parse_args(['--write']).write).toBe(true)
      expect(parse_args([]).project).toBe('realness-online')
      expect(parse_args(['--project', 'staging']).project).toBe('staging')
    })

    it('reads a phone number out of a listing prefix', () => {
      expect(e64_from_prefix('gs://b/people/+14155550101/')).toBe(e64)
      expect(e64_from_prefix('gs://b/people/')).toBeNull()
      expect(e64_from_prefix('gs://b/subscriptions/+14155550101/')).toBeNull()
    })
  })
})
