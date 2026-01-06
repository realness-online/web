import { MB } from '@/utils/numbers'

const win = /** @type {any} */ (window)
const request_file_system = win.requestFileSystem || win.webkitRequestFileSystem
const storage_type = win.PERSISTENT // or win.TEMPORARY
const file_size = MB // 1MB

const on_init = fs =>
  fs.root.getDirectory('realness', { create: true }, root_directory, on_error)
const on_error = error => console.error('filesystem error: ', error)

const root_directory = async directory => {
  console.info('Directory created: ', directory.fullPath, directory)
  const directoryHandle = await win.showDirectoryPicker()

  for await (const entry of directoryHandle.values())
    console.info(entry.kind, entry.name)

  // Use the directory entry
  // You can perform operations on the directory here
}

export const get_file_system = () =>
  request_file_system(storage_type, file_size, on_init, on_error)
