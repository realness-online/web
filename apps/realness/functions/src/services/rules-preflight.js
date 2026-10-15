/**
 * Copying `relations.html.gz` to `relations.html` is a privacy leak unless the
 * live Storage rules already protect the new name: the rules before the
 * migration only exclude `relations.html.gz` from public reads.
 * @param {string} source The released storage.rules text
 * @returns {boolean}
 */
export const rules_protect_both = source =>
  /in\s*\[\s*'relations\.html'\s*,\s*'relations\.html\.gz'\s*\]/.test(source) &&
  !/allow get: if file != 'relations\.html\.gz'/.test(source)

/**
 * The storage rules currently released for a bucket.
 * @param {object} options
 * @param {string} options.project
 * @param {string} options.bucket_name
 * @param {(url: string) => Promise<{ rulesetName?: string, source?: { files?: { content: string }[] } }>} options.fetch_json authorized GET
 * @returns {Promise<string>}
 */
export const released_storage_rules = async ({ project, bucket_name, fetch_json }) => {
  const base = `https://firebaserules.googleapis.com/v1/projects/${project}`
  const release = await fetch_json(`${base}/releases/firebase.storage/${bucket_name}`)
  if (!release?.rulesetName) throw new Error('No storage rules released for this bucket')
  const ruleset = await fetch_json(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`)
  return (ruleset?.source?.files || []).map(file => file.content).join('\n')
}
