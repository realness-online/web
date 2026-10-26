import { is_zipped, unzip, zip } from '#root/src/files/zip.js'

/**
 * sy18: a test bucket that reads like before. A plain harness key a spec
 * writes lands as `<key>.gz`, zipped, the way the client sends it; a plain
 * read unzips. `.gz` keys, and everything outside the harness, pass through,
 * so the server sees exactly what clients store.
 */
export const zipped_storage = storage => {
  const plain = key => is_zipped(key) && !key.endsWith('.gz')
  return {
    ...storage,
    put: (key, body, options) =>
      plain(key)
        ? storage.put(`${key}.gz`, zip(Buffer.from(body)), options)
        : storage.put(key, body, options),
    async get(key) {
      if (!plain(key)) return storage.get(key)
      const file = await storage.get(`${key}.gz`)
      return file && { ...file, body: unzip(file.body) }
    }
  }
}
