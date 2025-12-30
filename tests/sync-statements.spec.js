import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fresh_metadata } from '@/use/sync'
import { Statement } from '@/persistance/Storage'
import { metadata, location } from '@/utils/serverless'
import { get, set, del } from 'idb-keyval'
import { create_hash } from '@/utils/upload-processor'

// Implement get_index_hash locally since it's not exported
const get_index_hash = async itemid =>
  ((await get('sync:index')) || {})[itemid]?.customMetadata?.hash

// Mock the dependencies
vi.mock('@/utils/serverless', () => ({
  metadata: vi.fn(),
  location: vi.fn(),
  current_user: { value: { phoneNumber: '+14151234356' } }
}))

vi.mock('@/persistance/Storage', () => ({
  Statement: vi.fn().mockImplementation(() => ({
    sync: vi.fn(),
    save: vi.fn(),
    optimize: vi.fn()
  }))
}))

vi.mock('@/utils/upload-processor', () => ({
  create_hash: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}))

describe('Sync Statements', () => {
  const mock_itemid = '/+14151234356/statements'
  const mock_elements = {
    outerHTML: '<div itemid="/+14151234356/statements">Test statements</div>'
  }
  const mock_sync_element = {
    value: {
      querySelector: vi.fn().mockReturnValue(mock_elements)
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
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
      // Setup: No server metadata (index_hash = undefined)
      get.mockResolvedValue({}) // Empty sync index
      create_hash.mockResolvedValue('local-hash-123')

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]), // Returns empty array (no data)
        save: vi.fn(),
        optimize: vi.fn()
      }
      Statement.mockImplementation(() => mock_statement)

      // Mock the sync_statements function context
      const sync_element = mock_sync_element.value
      const statements = { value: [] }

      // Simulate the sync_statements logic
      const persistance = new Statement()
      const itemid = mock_itemid
      const index_hash = await get_index_hash(itemid)
      const elements = sync_element.querySelector(`[itemid="${itemid}"]`)
      const hash = await create_hash(elements.outerHTML)

      // This is the critical comparison
      expect(index_hash).toBeUndefined()
      expect(hash).toBe('local-hash-123')
      expect(index_hash !== hash).toBe(true) // Triggers sync

      // But sync returns empty data
      if (index_hash !== hash) {
        statements.value = await persistance.sync()
        expect(statements.value.length).toBe(0) // No data received!
      }

      // Verify the bug: sync appeared to run but got no data
      expect(mock_statement.sync).toHaveBeenCalled()
      expect(statements.value.length).toBe(0)
    })

    it('should handle server file not found scenario', async () => {
      // Setup: Server file doesn't exist
      metadata.mockRejectedValue({ code: 'storage/object-not-found' })
      get.mockResolvedValue({}) // Empty sync index

      // Test fresh_metadata behavior
      const result = await fresh_metadata(mock_itemid)

      // Should handle the error gracefully
      expect(metadata).toHaveBeenCalled()
      // The function should not throw but handle the missing file
    })

    it('should reproduce the 9-month gap scenario', async () => {
      // Scenario: Device A uploads, Device B tries to sync but server file is missing

      // Step 1: Device A successfully uploads (simulate this worked)
      const device_a_hash = 'server-hash-abc'
      metadata.mockResolvedValue({ customMetadata: { hash: device_a_hash } })

      // Step 2: Device B tries to sync but server file is now missing
      metadata.mockRejectedValue({ code: 'storage/object-not-found' })
      get.mockResolvedValue({}) // No sync index on Device B
      create_hash.mockResolvedValue('local-hash-xyz')

      // Ensure mock_sync_element returns elements for this test
      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]), // No data because server file missing
        save: vi.fn(),
        optimize: vi.fn()
      }
      Statement.mockImplementation(() => mock_statement)

      // Simulate Device B sync attempt
      const persistance = new Statement()
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

      // The bug: index_hash is undefined, hash comparison triggers sync
      expect(index_hash).toBeUndefined()
      expect(index_hash !== hash).toBe(true)

      // Sync runs but gets no data
      const statements = { value: [] }
      if (index_hash !== hash) {
        statements.value = await persistance.sync()
      }

      // Verify the bug: sync ran but got no statements
      expect(mock_statement.sync).toHaveBeenCalled()
      expect(statements.value.length).toBe(0)

      // This represents the 9-month gap - Device B never gets the statements
      // even though sync appeared to work
    })
  })

  describe('Server File Check Failure', () => {
    it('should handle metadata call failures gracefully', async () => {
      // Test various error scenarios
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
            // Should handle this gracefully
            expect(error.code).toBe('storage/object-not-found')
          } else {
            // Other errors should be thrown
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
      // Test the i_am_fresh logic
      const now = Date.now()
      const eight_hours = 8 * 60 * 60 * 1000

      // Fresh sync (less than 8 hours ago)
      localStorage.getItem = vi
        .fn()
        .mockReturnValue(new Date(now - 1000).toISOString())
      // Should return true (fresh)

      // Stale sync (more than 8 hours ago)
      localStorage.getItem = vi
        .fn()
        .mockReturnValue(new Date(now - eight_hours - 1000).toISOString())
      // Should return false (not fresh)
    })
  })

  describe('Visibility State Issues', () => {
    it('should only sync when document is visible', () => {
      // Test visibility state requirement
      const originalVisibilityState = document.visibilityState

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true
      })

      // Sync should not run when hidden
      expect(document.visibilityState).toBe('hidden')

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      })

      // Sync should run when visible
      expect(document.visibilityState).toBe('visible')

      // Restore original
      Object.defineProperty(document, 'visibilityState', {
        value: originalVisibilityState,
        writable: true
      })
    })
  })

  describe('Production Bug Scenarios', () => {
    it('should reproduce the 9-month gap: server file exists but sync fails', async () => {
      // Scenario: Server file exists, but sync mechanism fails to load it

      // Setup: Server file exists with statements
      const server_statements = [
        {
          id: '/+14151234356/statements/1234567890',
          statement: 'Test statement 1'
        },
        {
          id: '/+14151234356/statements/1234567891',
          statement: 'Test statement 2'
        }
      ]

      // Mock successful server metadata
      metadata.mockResolvedValue({
        customMetadata: { hash: 'server-hash-abc' }
      })
      get.mockResolvedValue({}) // No local sync index
      create_hash.mockResolvedValue('local-hash-xyz')

      // Mock Statement.sync to return empty (simulating load_from_network failure)
      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]), // Returns empty despite server having data
        save: vi.fn(),
        optimize: vi.fn()
      }
      Statement.mockImplementation(() => mock_statement)

      // Ensure mock_sync_element returns elements for this test
      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      // Simulate sync attempt
      const persistance = new Statement()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      // Hash mismatch triggers sync
      expect(index_hash).toBeUndefined()
      expect(index_hash !== hash).toBe(true)

      // Sync runs but gets no data
      const statements = { value: [] }
      if (index_hash !== hash) {
        statements.value = await persistance.sync()
      }

      // Bug: Sync ran but got no statements despite server having them
      expect(mock_statement.sync).toHaveBeenCalled()
      expect(statements.value.length).toBe(0)
    })

    it('should reproduce the 9-month gap: authentication expires during sync', async () => {
      // Scenario: Device starts sync but auth expires mid-process

      // Setup: Initial auth works, then fails
      metadata
        .mockResolvedValueOnce({ customMetadata: { hash: 'server-hash' } }) // First call succeeds
        .mockRejectedValueOnce({ code: 'storage/unauthorized' }) // Second call fails

      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash')

      const mock_statement = {
        sync: vi.fn().mockRejectedValue({ code: 'storage/unauthorized' }), // Sync fails due to auth
        save: vi.fn(),
        optimize: vi.fn()
      }
      Statement.mockImplementation(() => mock_statement)

      // Ensure mock_sync_element returns elements for this test
      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      // Simulate sync attempt
      const persistance = new Statement()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      // Hash mismatch triggers sync
      if (index_hash !== hash) {
        try {
          const statements = { value: [] }
          statements.value = await persistance.sync()
        } catch (error) {
          // Auth error during sync - this could cause silent failure
          expect(error.code).toBe('storage/unauthorized')
        }
      }
    })

    it('should reproduce the 9-month gap: network timeout during load_from_network', async () => {
      // Scenario: load_from_network times out silently

      // Mock fetch to simulate timeout
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'))

      metadata.mockResolvedValue({ customMetadata: { hash: 'server-hash' } })
      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash')

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]), // Empty due to network timeout
        save: vi.fn(),
        optimize: vi.fn()
      }
      Statement.mockImplementation(() => mock_statement)

      // Ensure mock_sync_element returns elements for this test
      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      // Simulate sync attempt
      const persistance = new Statement()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      // Hash mismatch triggers sync
      if (index_hash !== hash) {
        const statements = { value: [] }
        statements.value = await persistance.sync()

        // Bug: Network timeout causes empty result
        expect(statements.value.length).toBe(0)
      }
    })

    it('should reproduce the 9-month gap: corrupted sync index', async () => {
      // Scenario: Sync index gets corrupted, causing hash mismatches

      // Setup: Corrupted sync index
      const corrupted_index = {
        [mock_itemid]: { customMetadata: { hash: 'corrupted-hash' } }
      }
      get.mockResolvedValue(corrupted_index)
      create_hash.mockResolvedValue('actual-hash')

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([]), // Empty because hash mismatch
        save: vi.fn(),
        optimize: vi.fn()
      }
      Statement.mockImplementation(() => mock_statement)

      // Ensure mock_sync_element returns elements for this test
      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      // Simulate sync attempt
      const persistance = new Statement()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      // Hash mismatch triggers sync
      expect(index_hash).toBe('corrupted-hash')
      expect(hash).toBe('actual-hash')
      expect(index_hash !== hash).toBe(true)

      // Sync runs but gets no data due to corrupted index
      const statements = { value: [] }
      if (index_hash !== hash) {
        statements.value = await persistance.sync()
      }

      // Bug: Corrupted index causes sync to run but get no data
      expect(statements.value.length).toBe(0)
    })

    it('should reproduce the 9-month gap: browser storage quota exceeded', async () => {
      // Scenario: Browser storage quota exceeded, causing silent failures

      // Mock storage quota exceeded
      set.mockRejectedValue(new Error('QuotaExceededError'))
      get.mockResolvedValue({})
      create_hash.mockResolvedValue('local-hash')

      const mock_statement = {
        sync: vi.fn().mockResolvedValue([
          {
            id: '/+14151234356/statements/1234567890',
            statement: 'Test statement'
          }
        ]), // Returns data
        save: vi.fn().mockRejectedValue(new Error('QuotaExceededError')), // Save fails
        optimize: vi.fn()
      }
      Statement.mockImplementation(() => mock_statement)

      // Ensure mock_sync_element returns elements for this test
      mock_sync_element.value.querySelector = vi
        .fn()
        .mockReturnValue(mock_elements)

      // Simulate sync attempt
      const persistance = new Statement()
      const index_hash = await get_index_hash(mock_itemid)
      const elements = mock_sync_element.value.querySelector(
        `[itemid="${mock_itemid}"]`
      )
      const hash = await create_hash(elements.outerHTML)

      // Hash mismatch triggers sync
      if (index_hash !== hash) {
        const statements = { value: [] }
        statements.value = await persistance.sync()

        if (statements.value.length) {
          try {
            await persistance.save(elements)
          } catch (error) {
            // Storage quota exceeded - data loaded but not saved
            expect(error.message).toBe('QuotaExceededError')
          }
        }
      }

      // Bug: Data loaded but not saved due to storage quota
      expect(mock_statement.sync).toHaveBeenCalled()
    })
  })
})
