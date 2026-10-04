import { closeSync, fsyncSync, openSync, renameSync, writeSync } from "node:fs"
import { dirname } from "node:path"

/**
 * Replace a file so a crash leaves the old copy or the new, never an empty one.
 * Rename without fsync can land before the data on XFS: a 0-byte file.
 */
export function writeFileDurable(path, text) {
  const tmp = `${path}.tmp`
  const fd = openSync(tmp, "w")
  try {
    writeSync(fd, text)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, path)
  const dir = openSync(dirname(path), "r")
  try {
    fsyncSync(dir)
  } finally {
    closeSync(dir)
  }
}
