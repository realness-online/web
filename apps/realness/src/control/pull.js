/**
 * Pull: copy one store's files into another, one way.
 *
 *   pull({ from, to, prefixes, workers, on_file })
 *
 * `from` and `to` are `can` adapters, so the bucket's gzip and meta come
 * out as the plain bytes and meta the disk keeps. Versions differ between
 * adapters (MD5 against SHA-256), so a rerun compares size and time instead:
 * a file is copied when it is missing, its size changed, or the source was
 * updated after the copy was written. Nothing is ever written to `from`,
 * and nothing in `to` is deleted.
 */

/** The prefixes a local stack wants from production: people's files and their bills. */
const WORKERS = 16
const BYTES_PER_MB = 1e6

export const PULL_PREFIXES = ['people/', 'usage/', 'billing/']

/** A person's poster files: `people/+A/posters/...`. */
export const is_poster = key => /^people\/\+[^/]+\/posters\//.test(key)

/** True when `source` should overwrite what `target` holds, if anything. */
export const stale = (source, target) =>
  !target ||
  target.size !== source.size ||
  Date.parse(source.updated) > Date.parse(target.updated)

/**
 * @param {{
 *   from: any, to: any, prefixes?: string[], workers?: number,
 *   only?: (key: string) => boolean, overwrite?: boolean, dry_run?: boolean,
 *   on_file?: (key: string, done: number, total: number) => void
 * }} options
 */
export const pull = async ({
  from,
  to,
  prefixes = PULL_PREFIXES,
  workers = WORKERS,
  only = () => true,
  overwrite = false,
  dry_run = false,
  on_file = () => {}
}) => {
  /** @type {{ copied: string[], skipped: number, failed: { key: string, error: string }[], bytes: number }} */
  const report = { copied: [], skipped: 0, failed: [], bytes: 0 }
  /** @type {string[]} */
  const queue = []
  for (const prefix of prefixes) {
    // eslint-disable-next-line no-await-in-loop -- one prefix's listing at a time bounds memory
    const [source, target] = await Promise.all([
      from.walk_meta(prefix),
      to.walk_meta(prefix)
    ])
    for (const [name, info] of Object.entries(source)) {
      const key = `${prefix}${name}`
      if (!only(key)) continue
      if (overwrite || stale(info, target[name])) queue.push(key)
      else report.skipped += 1
    }
  }
  if (dry_run) {
    report.copied = queue
    return report
  }
  const total = queue.length
  let done = 0
  const worker = async () => {
    for (let key = queue.shift(); key; key = queue.shift()) {
      try {
        // eslint-disable-next-line no-await-in-loop -- each worker takes one file at a time
        const file = await from.get(key)
        if (file) {
          // eslint-disable-next-line no-await-in-loop -- the write follows its read
          await to.put(key, file.body, { meta: file.meta ?? {} })
          report.copied.push(key)
          report.bytes += file.body.length
        }
      } catch (error) {
        report.failed.push({ key, error: String(error?.message ?? error) })
      }
      done += 1
      on_file(key, done, total)
    }
  }
  await Promise.all(Array.from({ length: workers }, worker))
  return report
}

/** One line a person can read. */
export const pull_text = report =>
  `${report.copied.length} copied (${(report.bytes / BYTES_PER_MB).toFixed(1)} MB), ${report.skipped} already current, ${report.failed.length} failed\n${report.failed.map(({ key, error }) => `  ${key}: ${error}\n`).join('')}`
