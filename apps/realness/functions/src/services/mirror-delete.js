import { mirror_name } from '#services/mirror-name.js'

/**
 * Delete the live counterpart only if it still has the revision inspected by
 * the caller. Do not bind the File to a generation: that could delete an old
 * archived revision while leaving a replacement live.
 *
 * The caller must first establish that the source deletion is current, not
 * an overwrite/archive event or a delayed event preceding a recreation.
 * Never retry a failed precondition without rereading both names.
 * @param {object} options
 * @param {import('@google-cloud/storage').Bucket} options.bucket
 * @param {string} options.name
 * @param {string} options.target_generation
 * @param {string} options.target_metageneration
 */
export const mirror_delete = async ({ bucket, name, target_generation, target_metageneration }) => {
  const paired = mirror_name(name)
  if (!paired) throw new Error(`Not a mirrored item: ${name}`)
  if (typeof target_generation !== 'string' || !/^[1-9]\d*$/.test(target_generation) ||
    typeof target_metageneration !== 'string' || !/^[1-9]\d*$/.test(target_metageneration))
    throw new Error('Delete requires byte and metadata revisions')
  await bucket.file(paired).delete({
    ifGenerationMatch: target_generation,
    ifMetagenerationMatch: target_metageneration
  })
}
