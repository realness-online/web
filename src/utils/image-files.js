/**
 * @param {string} filename
 * @returns {boolean}
 */
export const is_image_file = filename =>
  /\.(jpg|jpeg|png|gif|webp|bmp|tiff|avif|svg)$/i.test(filename)

/**
 * @param {AsyncIterable<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>} entries
 * @returns {Promise<number>}
 */
export const count_image_files = async entries => {
  let count = 0
  for await (const [name, handle] of entries)
    if (handle.kind === 'file' && is_image_file(name)) count++
  return count
}

/**
 * @param {string} filename
 * @returns {string}
 */
export const poster_filename = filename => {
  const has_extension = filename.includes('.')
  return has_extension ? filename.replace(/\.[^/.]+$/, '.svg') : `${filename}.svg`
}

