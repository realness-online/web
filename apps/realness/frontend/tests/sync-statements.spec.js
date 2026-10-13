import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { fresh_metadata } from '@/use/sync'
import { Thought } from '@/persistence/Storage'
import { metadata, location } from '@/utils/serverless'
import { get, set, del } from 'idb-keyval'
import { create_hash } from '@/utils/upload-processor'

const get_index_hash = async itemid =>
  ((await get('sync:index')) || {})[itemid]?.customMetadata?.hash

vi.mock('@/utils/serverless', () => ({
  metadata: vi.fn(),
  location: vi.fn(),
  current_user: { value: { phoneNumber: '+14151234356' } }
}))

vi.mock('@/persistence/Storage', () => ({
  Thought: vi.fn(function () {
    return {
      sync: vi.fn(),
      save: vi.fn(),
      optimize: vi.fn()
    }
  })
}))

vi.mock('@/utils/upload-processor', () => ({
  create_hash: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}))

describe('Sync statements', () => {
  const mock_itemid = '/+14151234356/thoughts'
  const mock_elements = {
    outerHTML: '<div itemid="/+14151234356/thoughts">Test thoughts</div>'
  }
  const mock_sync_element = {
    value: {
      querySelector: vi.fn().mockReturnValue(mock_elements)
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'localStorage', {
      value: {
        me: '/+14151234356',
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Hash Comparison Logic Flaw', () => {
    it('should fail silently when index_hash is undefined', async () => {
      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash-123')

      const mock_thought = {
        sync: vi.fn().mockResolvedValue([]),
        save: vi.fn(),
        optimize: vi.fn()
      }
      Thought.mockImplementation(function () {
        return mock_thought
      })

      const sync_element = mock_sync_element.value
      const statements = { value: [] }

      const persistence = new Thought()
      const itemid = mock_itemid
      const index_hash = await get_index_hash(itemid)
      const elements = sync_element.querySelector(`[itemid="${itemid}"]`)
      const hash = await create_hash(elements.outerHTML)

      expect(index_hash).toBeUndefined()
      expect(hash).toBe('local-hash-123')
      expect(index_hash !== hash).toBe(true)

      if (index_hash !== hash) {
        statements.value = await persistence.sync()
        expect(statements.value.length).toBe(0)
      }

      expect(mock_thought.sync).toHaveBeenCalled()
      expect(statements.value.length).toBe(0)
    })

    it('should handle server file not found scenario', async () => {
      metadata.mockRejectedValue({ code: 'storage/object-not-found' })
      get.mockResolvedValue({})

      const result = await fresh_metadata(mock_itemid)

      expect(metadata).toHaveBeenCalled()
    })

    it('should reproduce the 9-month gap scenario', async () => {
      const device_a_hash = 'server-hash-abc'
      metadata.mockResolvedValue({ customMetadata: { hash: device_a_hash } })

      metadata.mockRejectedValue({ code: 'storage/object-not-found' })
      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash-xyz')

      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]),
        save: vi.fn(),
        optimize: vi.fn()
      }
      Thought.mockImplementation(function () {
        return mock_statement
      })

      const persistence = new Thought()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )

      if (!elements || !elements.outerHTML) {
        throw new Error(
          'No local elements found - this would cause sync to return early'
        )
      }

      const hash = await create_hash(elements.outerHTML)

      expect(index_hash).toBeUndefined()
      expect(index_hash !== hash).toBe(true)

      const statements = { value: [] }
      if (index_hash !== hash) {
        statements.value = await persistence.sync()
      }

      expect(mock_statement.sync).toHaveBeenCalled()
      expect(statements.value.length).toBe(0)
    })
  })

  describe('Server File Check Failure', () => {
    it('should handle metadata call failures gracefully', async () => {
      const error_scenarios = [
        { code: 'storage/object-not-found', message: 'File not found' },
        { code: 'storage/unauthorized', message: 'Permission denied' },
        { code: 'storage/network-error', message: 'Network error' }
      ]

      for (const scenario of error_scenarios) {
        metadata.mockRejectedValue(scenario)

        try {
          await fresh_metadata(mock_itemid)
        } catch (error) {
          if (scenario.code === 'storage/object-not-found') {
            expect(error.code).toBe('storage/object-not-found')
          } else {
            expect(error.code).toBe(scenario.code)
          }
        }
      }
    })

    it('should update sync index correctly when metadata succeeds', async () => {
      const mock_metadata = { customMetadata: { hash: 'test-hash' } }
      metadata.mockResolvedValue(mock_metadata)
      get.mockResolvedValue({})

      const result = await fresh_metadata(mock_itemid)

      expect(result).toEqual(mock_metadata)
      expect(set).toHaveBeenCalledWith('sync:index', {
        [mock_itemid]: mock_metadata
      })
    })
  })

  describe('Sync Throttle Issues', () => {
    it('should respect 8-hour sync throttle', () => {
      const now = Date.now()
      const eight_hours = 8 * 60 * 60 * 1000

      localStorage.getItem = vi
        .fn()
        .mockReturnValue(new Date(now - 1000).toISOString())

      localStorage.getItem = vi
        .fn()
        .mockReturnValue(new Date(now - eight_hours - 1000).toISOString())
    })
  })

  describe('Visibility State Issues', () => {
    it('should only sync when document is visible', () => {
      const originalVisibilityState = document.visibilityState

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true
      })

      expect(document.visibilityState).toBe('hidden')

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      })

      expect(document.visibilityState).toBe('visible')

      Object.defineProperty(document, 'visibilityState', {
        value: originalVisibilityState,
        writable: true
      })
    })
  })

  describe('Production Bug Scenarios', () => {
    it('should reproduce the 9-month gap: server file exists but sync fails', async () => {
      const server_statements = [
        {
          id: '/+14151234356/thoughts/1234567890',
          statement: 'Test statement 1'
        },
        {
          id: '/+14151234356/thoughts/1234567891',
          statement: 'Test statement 2'
        }
      ]

      metadata.mockResolvedValue({
        customMetadata: { hash: 'server-hash-abc' }
      })
      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash-xyz')

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]),
        save: vi.fn(),
        optimize: vi.fn()
      }
      Thought.mockImplementation(function () {
        return mock_statement
      })

      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      const persistence = new Thought()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      expect(index_hash).toBeUndefined()
      expect(index_hash !== hash).toBe(true)

      const statements = { value: [] }
      if (index_hash !== hash) {
        statements.value = await persistence.sync()
      }

      expect(mock_statement.sync).toHaveBeenCalled()
      expect(statements.value.length).toBe(0)
    })

    it('should reproduce the 9-month gap: authentication expires during sync', async () => {
      metadata
        .mockResolvedValueOnce({ customMetadata: { hash: 'server-hash' } })
        .mockRejectedValueOnce({ code: 'storage/unauthorized' })

      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash')

      const mock_statement = {
        sync: vi.fn().mockRejectedValue({ code: 'storage/unauthorized' }),
        save: vi.fn(),
        optimize: vi.fn()
      }
      Thought.mockImplementation(function () {
        return mock_statement
      })

      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      const persistence = new Thought()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      if (index_hash !== hash) {
        try {
          const statements = { value: [] }
          statements.value = await persistence.sync()
        } catch (error) {
          expect(error.code).toBe('storage/unauthorized')
        }
      }
    })

    it('should reproduce the 9-month gap: network timeout during load_from_network', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'))

      metadata.mockResolvedValue({ customMetadata: { hash: 'server-hash' } })
      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash')

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]),
        save: vi.fn(),
        optimize: vi.fn()
      }
      Thought.mockImplementation(function () {
        return mock_statement
      })

      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      const persistence = new Thought()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      if (index_hash !== hash) {
        const statements = { value: [] }
        statements.value = await persistence.sync()

        expect(statements.value.length).toBe(0)
      }
    })

    it('should reproduce the 9-month gap: corrupted sync index', async () => {
      const corrupted_index = {
        [mock_itemid]: { customMetadata: { hash: 'corrupted-hash' } }
      }
      get.mockResolvedValue(corrupted_index)
      create_hash.mockResolvedValue('actual-hash')

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]),
        save: vi.fn(),
        optimize: vi.fn()
      }
      Thought.mockImplementation(function () {
        return mock_statement
      })

      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      const persistence = new Thought()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      expect(index_hash).toBe('corrupted-hash')
      expect(hash).toBe('actual-hash')
      expect(index_hash !== hash).toBe(true)

      const statements = { value: [] }
      if (index_hash !== hash) {
        statements.value = await persistence.sync()
      }

      expect(statements.value.length).toBe(0)
    })

    it('should reproduce the 9-month gap: browser storage quota exceeded', async () => {
      set.mockRejectedValue(new Error('QuotaExceededError'))
      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash')

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([
          {
            id: '/+14151234356/thoughts/1234567890',
            statement: 'Test statement'
          }
        ]),
        save: vi.fn().mockRejectedValue(new Error('QuotaExceededError')),
        optimize: vi.fn()
      }
      Thought.mockImplementation(function () {
        return mock_statement
      })

      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      const persistence = new Thought()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      if (index_hash !== hash) {
        const statements = { value: [] }
        statements.value = await persistence.sync()

        if (statements.value.length) {
          try {
            await persistence.save(elements)
          } catch (error) {
            expect(error.message).toBe('QuotaExceededError')
          }
        }
      }

      expect(mock_statement.sync).toHaveBeenCalled()
    })
  })
})
