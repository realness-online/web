import { isDeepStrictEqual as is_deep_strict_equal } from 'node:util'
import { mirror_name } from '#services/mirror-name.js'

export const representation = object => ({
  md5Hash: object.md5Hash,
  size: object.size,
  contentType: object.contentType,
  contentEncoding: object.contentEncoding,
  cacheControl: object.cacheControl,
  contentDisposition: object.contentDisposition,
  contentLanguage: object.contentLanguage,
  metadata: object.metadata || {}
})

/**
 * Report only. Never pick a winner for divergent copies from a listing.
 * Generation IDs stay strings; tokens and private metadata stay out of output.
 * Matching hashes alone are insufficient: sold flags and encoding matter too.
 * @param {StorageObject[]} objects Storage object metadata, not File handles
 * @returns {Array<object>}
 */

/**
 * One Storage object as the listing returns it. Generation stays a string.
 * @typedef {object} StorageObject
 * @property {string} name
 * @property {string} [generation]
 * @property {string} [md5Hash]
 */
export const migration_report = objects => {
  const by_name = new Map(objects.map(object => [object.name, object]))
  const report = []
  for (const source of objects) {
    const target_name = mirror_name(source.name)
    if (!target_name || !source.name.endsWith('.html.gz')) continue
    const target = by_name.get(target_name)
    let status = 'copy'
    if (!source.generation || !source.md5Hash) status = 'unverified'
    else if (target) {
      status = target.md5Hash && is_deep_strict_equal(
        representation(source), representation(target)
      ) ? 'matched' : 'conflict'
    }
    report.push({
      source: source.name,
      target: target_name,
      source_generation: source.generation,
      target_generation: target?.generation || '0',
      status
    })
  }
  return report.sort((a, b) => a.source.localeCompare(b.source))
}
