import fs from 'node:fs'
import path from 'node:path'

/**
 * Drop the rastered pngs from a frame directory, leaving the traced svgs.
 *
 * The pngs are scratch: the svgs beside them are the master and re-raster at
 * any width without re-tracing, so a finished encode has no reason to keep
 * gigabytes of them. Only `.png` is touched - everything else stays.
 *
 * @param {string} poster_dir
 * @returns {{ count: number, bytes: number }}
 */
export const clear_raster_frames = poster_dir => {
  const frames = fs
    .readdirSync(poster_dir)
    .filter(name => name.endsWith('.png'))
    .map(name => path.join(poster_dir, name))
  const bytes = frames.reduce(
    (total, file) => total + fs.statSync(file).size,
    0
  )
  for (const file of frames) fs.rmSync(file)
  return { count: frames.length, bytes }
}
