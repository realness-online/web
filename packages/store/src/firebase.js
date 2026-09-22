import {
  deleteObject,
  getBytes,
  getDownloadURL,
  getMetadata,
  listAll,
  uploadBytes,
  uploadString,
  StringFormat
} from 'firebase/storage'

/**
 * Firebase reports more than `uploadBytes` accepts, and throws on the extras.
 * Carry the fields that matter for an archive move.
 * @param {Record<string, any> | undefined} metadata
 */
const settable_metadata = metadata => {
  if (!metadata) return undefined
  const {
    contentType,
    cacheControl,
    contentDisposition,
    contentEncoding,
    contentLanguage,
    customMetadata
  } = metadata
  const settable = {}
  if (contentType) settable.contentType = contentType
  if (cacheControl) settable.cacheControl = cacheControl
  if (contentDisposition) settable.contentDisposition = contentDisposition
  if (contentEncoding) settable.contentEncoding = contentEncoding
  if (contentLanguage) settable.contentLanguage = contentLanguage
  if (customMetadata) settable.customMetadata = customMetadata
  return Object.keys(settable).length ? settable : undefined
}

/**
 * Firebase has no move, so `move` copies the bytes and metadata, then deletes the
 * source; a failed delete takes the copy with it so an item is never in two
 * places. Exported alone for apps that keep their own upload/remove wrappers.
 * @param {{ location: (path: string) => import('firebase/storage').StorageReference }} config
 */
export const create_firebase_move =
  ({ location }) =>
  async (from, to) => {
    const source = location(from)
    const target = location(to)
    let copied = false
    try {
      const [bytes, metadata] = await Promise.all([
        getBytes(source),
        getMetadata(source)
      ])
      await uploadBytes(target, bytes, settable_metadata(metadata))
      copied = true
      await deleteObject(source)
      return true
    } catch (e) {
      if (copied)
        try {
          await deleteObject(target)
        } catch (cleanup_error) {
          console.error(
            `Failed to clean up ${to}`,
            cleanup_error instanceof Error
              ? cleanup_error.message
              : String(cleanup_error)
          )
        }
      console.error(
        `Failed to move ${from}`,
        e instanceof Error ? e.message : String(e)
      )
      return false
    }
  }

/**
 * The Firebase implementation of every Backend method, from a `location(path)`
 * that returns a StorageReference.
 * @param {{
 *   location?: (path: string) => import('firebase/storage').StorageReference,
 *   online?: () => boolean,
 *   signed_in?: () => boolean,
 *   can_read?: (itemid: string) => boolean,
 *   serialize?: (items: object | string) => Promise<{compressed: string | Blob, metadata: object}>,
 *   after_upload?: (itemid: string, path: string, response: object) => Promise<void>,
 *   after_directory?: (itemids: string[]) => Promise<void>,
 *   later?: (itemid: string, action: 'save' | 'delete') => Promise<void>
 * }} config
 */
export const create_firebase_backend = ({
  location,
  online = () => navigator.onLine,
  signed_in = () => false,
  can_read,
  serialize,
  after_upload,
  after_directory,
  later
} = {}) => {
  if (typeof location !== 'function')
    throw new Error('create_firebase_backend needs location(path)')
  const locate = /** @type {NonNullable<typeof location>} */ (location)

  return {
    upload: (path, body, metadata) =>
      body instanceof Blob
        ? uploadBytes(locate(path), body, metadata)
        : uploadString(locate(path), body, StringFormat.RAW, metadata),

    remove: async path => {
      try {
        await deleteObject(locate(path))
      } catch (e) {
        if (
          e &&
          typeof e === 'object' &&
          'code' in e &&
          e.code === 'storage/object-not-found'
        )
          console.warn(path, 'already deleted')
        else throw e
      }
    },

    move: create_firebase_move({ location: locate }),

    url: path => getDownloadURL(locate(path)),
    directory: path => listAll(locate(path)),
    online,
    signed_in,
    can_read,
    serialize,
    after_upload,
    after_directory,
    later
  }
}
