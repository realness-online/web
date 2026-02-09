/**
 * File System Access API (showDirectoryPicker). Supported in Chrome/Edge/Opera 86+.
 * Not supported in Firefox or Safari. Requires secure context (HTTPS).
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export const get_file_system = () => window.showDirectoryPicker()
