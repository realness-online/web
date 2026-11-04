import { execFileSync as exec_file_sync } from 'node:child_process'
import { existsSync as exists_sync, statSync as stat_sync } from 'node:fs'
import { basename, join } from 'node:path'

/**
 * Files under `target` that git would commit, tracked or new, that `keep`
 * accepts. `.gitignore` decides what is left out; `keep` gets the path
 * relative to `target`.
 * @param {string} target a folder or a file
 * @param {(name: string) => boolean} keep
 * @returns {string[]}
 */
export const source_files = (target, keep) => {
  if (!exists_sync(target)) return []
  if (stat_sync(target).isFile()) return keep(basename(target)) ? [target] : []
  return exec_file_sync('git', ['-C', target, 'ls-files', '-co', '--exclude-standard', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
    .split('\0')
    .filter(Boolean)
    .filter(name => keep(name) && exists_sync(join(target, name)))
    .map(name => join(target, name))
}

/**
 * A line over 1000 characters marks bundled or minified output.
 * @param {string} text
 */
export const is_minified = text => text.split('\n').some(line => line.length > 1000)

/**
 * Whether a relative path passes through one of `folders`.
 * @param {string} name
 * @param {Set<string>} folders
 */
export const inside = (name, folders) =>
  name
    .split('/')
    .slice(0, -1)
    .some(part => folders.has(part))
