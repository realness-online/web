/**
 * File System Access API (showDirectoryPicker). Supported in Chrome/Edge/Opera 86+.
 * Not supported in Firefox or Safari. Requires secure context (HTTPS).
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
const win =
  /** @type {Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }} */ (
    window
  )
export const get_file_system = () => {
  const fn = win.showDirectoryPicker
  if (!fn) throw new Error('showDirectoryPicker not supported')
  return fn.call(win)
}
