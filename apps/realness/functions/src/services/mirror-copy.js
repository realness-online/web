import { mirror_name } from '#services/mirror-name.js'

const revision = value => typeof value === 'string' && /^[1-9]\d*$/.test(value)

/**
 * Server-side rewrite with both byte and metadata revision guards.
 * File.copy in the installed SDK drops metadata preconditions, so use the
 * authenticated JSON API. Repeat every guard on every rewrite-token request.
 * Failed preconditions surface; never retry them unconditionally.
 *
 * No metadata body means preserve encoding, tokens, hash and sold flags.
 * All generation IDs remain strings, even beyond integer precision.
 * @param {object} options
 * @param {import('@google-cloud/storage').Bucket} options.bucket
 * @param {string} options.name
 * @param {string} options.source_generation
 * @param {string} options.source_metageneration
 * @param {string} options.target_generation Zero means target must be absent
 * @param {string} [options.target_metageneration]
 */
export const mirror_copy = async ({
  bucket, name, source_generation, source_metageneration,
  target_generation, target_metageneration
}) => {
  const paired = mirror_name(name)
  if (!paired) throw new Error(`Not a mirrored item: ${name}`)
  if (!revision(source_generation) || !revision(source_metageneration))
    throw new Error('Copy requires source byte and metadata revisions')
  if (target_generation !== '0' &&
    (!revision(target_generation) || !revision(target_metageneration)))
    throw new Error('Copy requires target revisions or explicit absence')

  const source = bucket.file(name)
  const uri = `/rewriteTo/b/${bucket.name}/o/${encodeURIComponent(paired)}`
  const request = params => new Promise((resolve, reject) => {
    source.request({ method: 'POST', uri, qs: params, json: {} }, (error, data) =>
      error ? reject(error) : resolve(data)
    )
  })
  const guards = {
    ifSourceGenerationMatch: source_generation,
    ifSourceMetagenerationMatch: source_metageneration,
    ifGenerationMatch: target_generation
  }
  if (target_generation !== '0') guards.ifMetagenerationMatch = target_metageneration
  let token
  do {
    // eslint-disable-next-line no-await-in-loop -- rewrite tokens form one operation
    const data = await request(token ? { ...guards, rewriteToken: token } : guards)
    if (data.done && data.resource?.generation) return data.resource
    if (!data.rewriteToken || data.rewriteToken === token)
      throw new Error('Storage rewrite did not complete or advance')
    token = data.rewriteToken
  } while (token)
}
