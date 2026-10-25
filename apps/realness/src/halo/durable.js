import {
  closeSync as close_sync,
  fsyncSync as fsync_sync,
  openSync as open_sync,
  renameSync as rename_sync,
  writeSync as write_sync
} from 'node:fs'
import { dirname } from 'node:path'

/**
 * Replace a file so a crash leaves the old copy or the new, never an empty one.
 * Rename without fsync can land before the data on XFS: a 0-byte file.
 */
export const write_file_durable = (path, text) => {
  const tmp = `${path}.tmp`
  const fd = open_sync(tmp, 'w')
  try {
    write_sync(fd, text)
    fsync_sync(fd)
  } finally {
    close_sync(fd)
  }
  rename_sync(tmp, path)
  const dir = open_sync(dirname(path), 'r')
  try {
    fsync_sync(dir)
  } finally {
    close_sync(dir)
  }
}
