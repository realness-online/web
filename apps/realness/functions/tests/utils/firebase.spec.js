import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_initialize_app, mock_get_storage, mock_bucket_fn, mock_bucket } =
  vi.hoisted(() => {
    const mock_bucket = { name: 'fake-bucket' }
    return {
      mock_initialize_app: vi.fn(),
      mock_get_storage: vi.fn(),
      mock_bucket_fn: vi.fn(() => mock_bucket),
      mock_bucket
    }
  })

vi.mock('firebase-admin/app', () => ({
  initializeApp: mock_initialize_app
}))

vi.mock('firebase-admin/storage', () => ({
  getStorage: mock_get_storage
}))

describe('#utils/firebase', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mock_get_storage.mockReturnValue({ bucket: mock_bucket_fn })
    process.env.GCLOUD_PROJECT = 'realness-online'
  })

  it('initializes the app scoped to the project storage bucket', async () => {
    await import('#utils/firebase.js')

    expect(mock_initialize_app).toHaveBeenCalledWith({
      storageBucket: 'realness-online.appspot.com'
    })
  })

  it('exports the default bucket', async () => {
    const { bucket } = await import('#utils/firebase.js')

    expect(bucket).toBe(mock_bucket)
  })
})
