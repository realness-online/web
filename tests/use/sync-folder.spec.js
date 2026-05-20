import { describe, it, expect } from 'vite-plus/test'
import { sync_folder_supported } from '@/use/sync-folder'

describe('@/use/sync-folder', () => {
  it('sync_folder_supported is false when File System Access API is missing', () => {
    expect(sync_folder_supported()).toBe(false)
  })
})
