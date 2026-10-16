import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'

const { mock_upload, mock_prepare, current_user } = vi.hoisted(() => ({
  mock_upload: vi.fn(() => Promise.resolve()),
  mock_prepare: vi.fn(() =>
    Promise.resolve({ compressed: 'body', metadata: { hash: 'abc' } })
  ),
  current_user: { value: { uid: 'test-user' } }
}))

vi.mock('@/utils/serverless', () => ({
  current_user,
  upload: (...args) => mock_upload(...args),
  location: path => `storage/${path}`
}))

vi.mock('@/utils/upload-processor', () => ({
  prepare_upload_html: (...args) => mock_prepare(...args)
}))

vi.mock('@/utils/itemid', async importOriginal => ({
  ...(await importOriginal()),
  as_filename: () => Promise.resolve('history.html.gz')
}))

vi.mock('@/persistence/Repository', () => ({
  Storage: class {
    constructor(itemid) {
      this.itemid = itemid
    }
  }
}))

const { History } = await import('@/persistence/History')

describe('@/persistence/History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    current_user.value = { uid: 'test-user' }
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true
    })
  })

  it('keeps the itemid it was built with', () => {
    const history = new History('/+14151234356/statements/1')

    expect(history.id).toBe('/+14151234356/statements/1')
  })

  it('saves nothing when given nothing', async () => {
    const history = new History('/+14151234356/statements/1')

    expect(await history.save()).toBe(false)
    expect(mock_prepare).not.toHaveBeenCalled()
  })

  it('uploads the prepared history page', async () => {
    const history = new History('/+14151234356/statements/1')
    const items = { outerHTML: '<section></section>' }

    expect(await history.save(items)).toBe(true)
    expect(mock_prepare).toHaveBeenCalledWith(items)
    expect(mock_upload).toHaveBeenCalledWith('history.html.gz', 'body', {
      hash: 'abc'
    })
  })

  it('reports a failed upload without throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mock_upload.mockRejectedValueOnce(new Error('quota'))
    const history = new History('/+14151234356/statements/1')

    expect(await history.save({ outerHTML: '<section></section>' })).toBe(false)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('does not upload for a signed-out reader', async () => {
    current_user.value = null
    const history = new History('/+14151234356/statements/1')

    expect(await history.save({ outerHTML: '<section></section>' })).toBe(false)
    expect(mock_upload).not.toHaveBeenCalled()
  })

  it('does not upload while offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true
    })
    const history = new History('/+14151234356/statements/1')

    expect(await history.save({ outerHTML: '<section></section>' })).toBe(false)
    expect(mock_upload).not.toHaveBeenCalled()
  })
})
