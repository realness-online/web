import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'

const { mock_sync_folder_pref, mock_enqueue_folder_sync } = vi.hoisted(() => ({
  mock_sync_folder_pref: { value: true },
  mock_enqueue_folder_sync: vi.fn(() => Promise.resolve())
}))

vi.mock('@/utils/preference', () => ({
  sync_folder: mock_sync_folder_pref
}))

vi.mock('@/use/sync-folder', () => ({
  enqueue_folder_sync: mock_enqueue_folder_sync
}))

import { Folder } from '@/persistence/Folder'

// A base persistence class the mixin wraps, recording save/delete calls.
const make_base = () => {
  class Base {
    constructor(id) {
      this.id = id
    }
    async save() {}
    async delete() {}
  }
  const saved = vi.spyOn(Base.prototype, 'save')
  const deleted = vi.spyOn(Base.prototype, 'delete')
  return { Base, saved, deleted }
}

describe('@/persistence/Folder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_sync_folder_pref.value = true
    mock_enqueue_folder_sync.mockResolvedValue(undefined)
  })

  const poster_id = '/+15551234567/posters/1720119797893'
  const thoughts_id = '/+15551234567/thoughts/abc'
  const other_id = '/+15551234567/events/xyz'

  it('save enqueues the resolved poster id when sync is on', async () => {
    const { Base, saved } = make_base()
    const Klass = Folder(Base)
    const inst = new Klass(poster_id)
    await inst.save()
    expect(saved).toHaveBeenCalledTimes(1)
    expect(mock_enqueue_folder_sync).toHaveBeenCalledWith(poster_id, 'save')
  })

  it('save passes through even when sync preference is off', async () => {
    const { Base, saved } = make_base()
    mock_sync_folder_pref.value = false
    const Klass = Folder(Base)
    const inst = new Klass(poster_id)
    await inst.save()
    expect(saved).toHaveBeenCalledTimes(1)
    expect(mock_enqueue_folder_sync).not.toHaveBeenCalled()
  })

  it('save does not enqueue for a non-syncable item id', async () => {
    const { Base } = make_base()
    const Klass = Folder(Base)
    const inst = new Klass(other_id)
    await inst.save()
    expect(mock_enqueue_folder_sync).not.toHaveBeenCalled()
  })

  it('delete enqueues a delete for a thoughts id', async () => {
    const { Base, deleted } = make_base()
    const Klass = Folder(Base)
    const inst = new Klass(thoughts_id)
    await inst.delete()
    expect(deleted).toHaveBeenCalledTimes(1)
    expect(mock_enqueue_folder_sync).toHaveBeenCalledWith(thoughts_id, 'delete')
  })

  it('delete does not enqueue when the pref is off', async () => {
    const { Base } = make_base()
    mock_sync_folder_pref.value = false
    const Klass = Folder(Base)
    const inst = new Klass(poster_id)
    await inst.delete()
    expect(mock_enqueue_folder_sync).not.toHaveBeenCalled()
  })
})
