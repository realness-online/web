#!/usr/bin/env node
/**
 * Print a log as it grows and exit on the line that ends it. The file's own
 * changes drive it: fs.watch, no polling.
 *
 *   node scripts/follow.js <file> [end-pattern]
 */
import {
  closeSync as close_sync,
  existsSync as exists_sync,
  openSync as open_sync,
  readSync as read_sync,
  statSync as stat_sync,
  watch,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, basename } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

/** The line a scout run prints last. */
export const RUN_DONE = /^done \d+ sources$/m

/**
 * Follow a file until a line matches the end pattern.
 * @param {string} file
 * @param {RegExp} end
 * @param {(text: string) => void} print
 * @returns {Promise<void>}
 */
export const follow = (file, end, print) =>
  new Promise(done => {
    if (!exists_sync(file)) write_file_sync(file, '')
    let at = 0
    let seen = ''
    const read = () => {
      const { size } = stat_sync(file)
      if (size <= at) return
      const fd = open_sync(file, 'r')
      const buffer = Buffer.alloc(size - at)
      read_sync(fd, buffer, 0, buffer.length, at)
      close_sync(fd)
      at = size
      const text = buffer.toString()
      print(text)
      seen += text
      if (end.test(seen)) {
        watcher.close()
        done()
      }
    }
    const watcher = watch(dirname(file), (_kind, name) => {
      if (name === basename(file)) read()
    })
    read()
  })

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const [file, pattern] = process.argv.slice(2)
  await follow(file, pattern ? new RegExp(pattern, 'm') : RUN_DONE, text =>
    process.stdout.write(text)
  )
}
