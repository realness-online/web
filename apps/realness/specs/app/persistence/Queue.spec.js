import { describe, it, expect, beforeEach, vi } from 'vite-plus/test'
import { get, set, del, keys } from 'idb-keyval'
import * as Queue from '@/persistence/Queue'

/** @type {import('@/types').Id} */
const poster_id = '/+15551234567/posters/1720119797893'
const queue_key = `queue:posters:${poster_id}`

const pending_item = () => ({
  id: poster_id,
  itemid: poster_id,
  resized_blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
  status: /** @type {const} */ ('pending'),
  progress: 0,
  width: 100,
  height: 100
})

describe('@/persistence/Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keys.mockResolvedValue([])
    get.mockResolvedValue(null)
    set.mockResolvedValue(undefined)
    del.mockResolvedValue(undefined)
  })

  it('add stores blob as ArrayBuffer and get_next restores Blob', async () => {
    await Queue.add(pending_item())

    expect(set).toHaveBeenCalledWith(
      queue_key,
      expect.objectContaining({
        status: 'pending',
        resized_blob: expect.any(ArrayBuffer)
      })
    )

    keys.mockResolvedValue([queue_key])
    get.mockResolvedValue({
      ...pending_item(),
      resized_blob: new ArrayBuffer(4)
    })

    const next = await Queue.get_next()
    expect(next?.status).toBe('pending')
    expect(next?.resized_blob).toBeInstanceOf(Blob)
  })

  it('get_next skips non-pending items', async () => {
    keys.mockResolvedValue(['queue:posters:111', 'queue:posters:222'])
    get.mockImplementation(key => {
      if (String(key).endsWith('111'))
        return Promise.resolve({
          ...pending_item(),
          id: /** @type {import('@/types').Id} */ ('/+1/posters/111'),
          status: 'complete'
        })
      return Promise.resolve({
        ...pending_item(),
        id: /** @type {import('@/types').Id} */ ('/+1/posters/222'),
        status: 'pending',
        resized_blob: null
      })
    })

    const next = await Queue.get_next()
    expect(next?.id).toBe('/+1/posters/222')
  })

  it('update merges partial fields', async () => {
    get.mockResolvedValue({
      ...pending_item(),
      resized_blob: null,
      progress: 0
    })

    await Queue.update(poster_id, { progress: 50, status: 'processing' })

    expect(set).toHaveBeenCalledWith(
      queue_key,
      expect.objectContaining({ progress: 50, status: 'processing' })
    )
  })

  it('remove deletes queue key', async () => {
    await Queue.remove(poster_id)
    expect(del).toHaveBeenCalledWith(queue_key)
  })

  it('get_all returns items sorted by id timestamp', async () => {
    keys.mockResolvedValue([
      'queue:posters:300',
      'queue:posters:100',
      'other:key'
    ])
    get.mockImplementation(key => {
      const id = String(key).replace('queue:posters:', '')
      return Promise.resolve({
        ...pending_item(),
        id: /** @type {import('@/types').Id} */ (`/+1/posters/${id}`),
        status: 'pending',
        resized_blob: null
      })
    })

    const all = await Queue.get_all()
    expect(all.map(i => i.id)).toEqual(['/+1/posters/100', '/+1/posters/300'])
  })
})
