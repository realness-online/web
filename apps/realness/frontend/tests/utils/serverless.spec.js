import { describe, it, expect, beforeEach, vi } from 'vite-plus/test'
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
  uploadBytes,
  uploadString
} from 'firebase/storage'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { initializeApp } from 'firebase/app'
import { get, set } from 'idb-keyval'

vi.mock('@/utils/upload-processor', () => ({
  prepare_upload_html: vi.fn(() =>
    Promise.resolve({
      compressed: 'gz',
      metadata: { contentType: 'text/html' }
    })
  )
}))

vi.mock('@/persistence/store-paths', async importOriginal => ({
  ...(await importOriginal()),
  as_filename: vi.fn(() =>
    Promise.resolve('people/+15551234567/posters/1720119797893.html.gz')
  )
}))

vi.mock('@/utils/itemid', () => ({
  load: vi.fn(() => Promise.resolve('<svg>poster</svg>')),
  load_from_network: vi.fn(() => Promise.resolve(null)),
  as_poster_id: vi.fn(() => '/+15551234567/posters/1720119797893')
}))

vi.mock('@/persistence/Directory', () => ({
  as_archive: vi.fn(() => Promise.resolve(null))
}))

describe('@/utils/serverless', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    initializeApp.mockReturnValue({ name: 'test-app' })
    getAuth.mockReturnValue({ uid: 'test-auth' })
    getStorage.mockReturnValue({ bucket: 'test-bucket' })
    onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null)
      return () => {}
    })
    ref.mockImplementation((_storage, path) => ({ path }))
    getDownloadURL.mockResolvedValue('https://storage.example/file.html.gz')
    getMetadata.mockResolvedValue({ size: 1 })
    listAll.mockResolvedValue({ prefixes: [], items: [] })
    uploadString.mockResolvedValue({})
    uploadBytes.mockResolvedValue({})
    deleteObject.mockResolvedValue(undefined)

    const { auth, current_user, me } = await import('@/utils/serverless')
    const { init_auth } = await import('@/utils/serverless-auth')
    auth.value = undefined
    current_user.value = undefined
    me.value = undefined
    await init_auth()
  })

  describe('sign_off', () => {
    it('calls signOut when auth is initialized', async () => {
      const { sign_off } = await import('@/utils/serverless-auth')
      const { auth } = await import('@/utils/serverless')
      auth.value = { uid: 'u1' }
      sign_off()
      expect(signOut).toHaveBeenCalledWith(auth.value)
    })

    it('does nothing when auth is missing', async () => {
      const { sign_off } = await import('@/utils/serverless-auth')
      const { auth } = await import('@/utils/serverless')
      auth.value = undefined
      sign_off()
      expect(signOut).not.toHaveBeenCalled()
    })
  })

  describe('storage helpers', () => {
    it('location throws when storage is not initialized', async () => {
      vi.resetModules()
      const { location } = await import('@/utils/serverless')
      expect(() => location('missing')).toThrow('Storage not initialized')
    })

    it('upload uses uploadBytes for Blob data', async () => {
      const { upload } = await import('@/utils/serverless')
      const blob = new Blob(['x'])
      await upload('path/file', blob, { contentType: 'image/jpeg' })
      expect(uploadBytes).toHaveBeenCalled()
      expect(uploadString).not.toHaveBeenCalled()
    })

    it('upload uses uploadString for string data', async () => {
      const { upload } = await import('@/utils/serverless')
      await upload('path/file', '<html></html>', {})
      expect(uploadString).toHaveBeenCalled()
      expect(uploadBytes).not.toHaveBeenCalled()
    })

    it('url resolves download URL for a path', async () => {
      const { url } = await import('@/utils/serverless')
      const resolved = await url('people/+1/posters/x.html.gz')
      expect(getDownloadURL).toHaveBeenCalled()
      expect(resolved).toBe('https://storage.example/file.html.gz')
    })

    it('metadata loads metadata for a path', async () => {
      const { metadata } = await import('@/utils/serverless')
      await metadata('people/+1/posters/x.html.gz')
      expect(getMetadata).toHaveBeenCalled()
    })

    it('directory lists a storage path', async () => {
      const { directory } = await import('@/utils/serverless')
      await directory('people/+1/posters/')
      expect(listAll).toHaveBeenCalled()
    })
  })

  describe('initialization', () => {
    it('initializes storage without starting authentication', async () => {
      vi.clearAllMocks()
      const { init_serverless } = await import('@/utils/serverless')
      const firebase_app = await init_serverless()

      expect(firebase_app).toEqual({ name: 'test-app' })
      expect(getStorage).toHaveBeenCalledWith(firebase_app)
      expect(getAuth).not.toHaveBeenCalled()
      expect(onAuthStateChanged).not.toHaveBeenCalled()
    })

    it('logs when firebase app initialization returns null', async () => {
      vi.resetModules()
      initializeApp.mockReturnValueOnce(null)
      getAuth.mockReturnValue({ uid: 'test-auth' })
      const error_log = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { init_serverless } = await import('@/utils/serverless')
      await init_serverless()

      expect(error_log).toHaveBeenCalledWith(
        'Firebase app initialization failed'
      )
      error_log.mockRestore()
    })

    it('hydrates me from network profile after sign-in', async () => {
      vi.resetModules()
      initializeApp.mockReturnValue({ name: 'test-app' })
      getAuth.mockReturnValue({ uid: 'test-auth' })
      getStorage.mockReturnValue({ bucket: 'test-bucket' })

      const profile = {
        id: '/+15551234567',
        type: 'person',
        name: 'Signed_in'
      }
      const { load_from_network } = await import('@/utils/itemid')
      load_from_network.mockResolvedValue(profile)

      onAuthStateChanged.mockImplementation((_auth, callback) => {
        callback({ phoneNumber: '+15551234567' })
        return () => {}
      })

      const { current_user, me } = await import('@/utils/serverless')
      const { init_auth } = await import('@/utils/serverless-auth')
      await init_auth()

      expect(localStorage.me).toBe('/+15551234567')
      expect(current_user.value).toEqual({ phoneNumber: '+15551234567' })
      expect(me.value).toEqual(profile)
    })

    it('clears current_user when auth callback receives null', async () => {
      vi.resetModules()
      initializeApp.mockReturnValue({ name: 'test-app' })
      getAuth.mockReturnValue({ uid: 'test-auth' })
      getStorage.mockReturnValue({ bucket: 'test-bucket' })

      onAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(null)
        return () => {}
      })

      const { current_user } = await import('@/utils/serverless')
      const { init_auth } = await import('@/utils/serverless-auth')
      await init_auth()

      expect(current_user.value).toBeNull()
    })
  })

  describe('remove', () => {
    it('warns and ignores object-not-found', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      deleteObject.mockRejectedValueOnce({ code: 'storage/object-not-found' })
      const { remove } = await import('@/utils/serverless')
      await remove('gone.html.gz')
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })

    it('rethrows unexpected storage errors', async () => {
      deleteObject.mockRejectedValueOnce({ code: 'storage/unauthorized' })
      const { remove } = await import('@/utils/serverless')
      await expect(remove('secret.html.gz')).rejects.toMatchObject({
        code: 'storage/unauthorized'
      })
    })
  })
})
