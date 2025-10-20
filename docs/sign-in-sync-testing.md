# Sign-In Sync Testing Plan

## Overview

The sign-in threshold is where anonymous local items (`/+/`) migrate to authenticated user items (`/{phone}/`). Multiple systems interact during this process, and failures can cause data loss or permission errors.

## Current Test Coverage

### ✅ Basic Migration Flow (`tests/components/sync.spec.js:194-248`)

```javascript
it('Processes anonymous statements from sync:offline queue', async () => {
  const anonymous_statement = {
    id: '/+/statements/123',
    action: 'save',
    type: 'statement',
    statement: 'Test anonymous statement'
  }
  await set('sync:offline', [anonymous_statement])

  const offline_save_spy = vi.spyOn(Offline.prototype, 'save')
  await sync_worker.sync_offline_actions()

  expect(offline_save_spy).toHaveBeenCalledWith()
  expect(await get('sync:offline')).toBeUndefined()
})

it('Migrates anonymous posters using Offline class', async () => {
  const created_at = Date.now()
  const anonymous_poster = {
    type: 'poster',
    content: 'Test poster content'
  }

  await set('/+/posters/', { items: [created_at] })
  await set(`/+/posters/${created_at}`, anonymous_poster)

  const offline_save_spy = vi.spyOn(Offline.prototype, 'save')
  await sync_worker.sync_offline_actions()

  expect(offline_save_spy).toHaveBeenCalled()
  expect(await get('/+/posters/')).toBeUndefined()
  expect(await get(`/+/posters/${created_at}`)).toBeUndefined()
})
```

**What's tested:**

- Anonymous items get processed
- Offline class is called
- Cleanup occurs after migration

### ✅ ID Transformation (`tests/components/sync.spec.js:313-380`)

```javascript
it('Transforms anonymous statement IDs to user IDs', async () => {
  const anonymous_id = '/+/statements/123'
  const expected_id = '/+16282281824/statements/123'
  const statement_html = '<div>Test statement</div>'

  await set(anonymous_id, statement_html)
  const offline = new Offline(anonymous_id)
  await offline.save()

  expect(offline.id).toBe(expected_id)
  expect(cloud_save_spy).toHaveBeenCalledWith({ outerHTML: statement_html })
})

it('Transforms anonymous poster IDs to user IDs', async () => {
  const anonymous_id = '/+/posters/1234567890'
  const expected_id = '/+16282281824/posters/1234567890'
  const poster_content = {
    type: 'poster',
    id: anonymous_id,
    content: 'Test poster content'
  }

  await set(anonymous_id, JSON.stringify(poster_content))
  const offline = new Offline(anonymous_id)
  await offline.save()

  expect(offline.id).toBe(expected_id)
  expect(cloud_save_spy).toHaveBeenCalledWith({
    ...poster_content,
    id: expected_id
  })
})
```

**What's tested:**

- ID rewriting works correctly
- Cloud save is called with transformed ID
- Already-transformed IDs aren't re-transformed

### ✅ Offline Detection (`tests/use/sync.spec.js:143-160`)

```javascript
it('returns early when offline', async () => {
  const original_online = navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    value: false,
    configurable: true
  })

  await sync_offline_actions()

  const { get } = await import('idb-keyval')
  expect(get).not.toHaveBeenCalled()

  Object.defineProperty(navigator, 'onLine', {
    value: original_online,
    configurable: true
  })
})
```

**What's tested:**

- No migration attempts when offline

## ❌ Missing Test Coverage

### Critical Gap: Delete Operations on Anonymous Items

**The Bug:**
User signs in, tries to delete poster created pre-authentication (`/+/posters/123`), gets Firebase permission error because path becomes `people/+/posters/123.html.gz`.

**Why it happened:**

- `Cloud.delete()` checked `current_user.value` (truthy after sign-in)
- Attempted cloud delete with incomplete phone number path
- Firebase rejected with permission error

**The Fix:**
Added guard in `Cloud.js` to skip cloud operations for `/+/` items:

```javascript
async delete() {
  console.info('request:delete', this.id)

  // Skip cloud deletion for items with incomplete phone numbers
  if (this.id.startsWith('/+/')) {
    console.info('Skipping cloud delete for local-only item:', this.id)
    if (super.delete) super.delete()
    return
  }

  // ... rest of delete logic
}
```

**Missing tests:**

1. **Delete anonymous item after sign-in**

   ```javascript
   it('Deletes anonymous poster locally without cloud operation after sign-in', async () => {
     setup_current_user() // User is signed in
     const anonymous_id = '/+/posters/123'

     await set(anonymous_id, '<svg>poster</svg>')

     const remove_spy = vi.spyOn(serverless, 'remove')
     const poster = new Poster(anonymous_id)
     await poster.delete()

     // Should delete locally
     expect(await get(anonymous_id)).toBeUndefined()

     // Should NOT attempt cloud delete
     expect(remove_spy).not.toHaveBeenCalled()
   })
   ```

2. **Save anonymous item after sign-in**

   ```javascript
   it('Skips cloud save for anonymous item after sign-in', async () => {
     setup_current_user()
     const anonymous_id = '/+/posters/123'
     const poster_html = '<svg itemid="/+/posters/123">poster</svg>'

     const upload_spy = vi.spyOn(serverless, 'upload')
     const poster = new Poster(anonymous_id)
     await poster.save(/* DOM element with poster_html */)

     // Should save locally
     expect(await get(anonymous_id)).toBeDefined()

     // Should NOT attempt cloud save
     expect(upload_spy).not.toHaveBeenCalled()
   })
   ```

### Edge Cases Not Covered

3. **Multiple anonymous posters migration**

   ```javascript
   it('Migrates multiple anonymous posters in sequence', async () => {
     const timestamps = [1000, 2000, 3000]

     for (const ts of timestamps) {
       await set(`/+/posters/${ts}`, `<svg>poster ${ts}</svg>`)
     }
     await set('/+/posters/', { items: timestamps })

     await sync_offline_actions()

     // All should be migrated
     for (const ts of timestamps) {
       expect(await get(`/+/posters/${ts}`)).toBeUndefined()
       expect(await get(`/+16282281824/posters/${ts}`)).toBeDefined()
     }
   })
   ```

4. **Partial migration failure recovery**

   ```javascript
   it('Handles failure during migration without losing data', async () => {
     const poster_1 = '/+/posters/1000'
     const poster_2 = '/+/posters/2000'

     await set(poster_1, '<svg>poster 1</svg>')
     await set(poster_2, '<svg>poster 2</svg>')
     await set('/+/posters/', { items: [1000, 2000] })

     // Mock cloud save to fail on second poster
     const upload_spy = vi.spyOn(serverless, 'upload')
     upload_spy.mockResolvedValueOnce(true)
     upload_spy.mockRejectedValueOnce(new Error('Network failure'))

     await sync_offline_actions()

     // First poster should be migrated
     expect(await get(`/+16282281824/posters/1000`)).toBeDefined()

     // Second poster should remain in anonymous state for retry
     expect(await get(poster_2)).toBeDefined()
   })
   ```

5. **Sign-in with existing cloud data**

   ```javascript
   it('Merges anonymous and cloud posters without duplicates', async () => {
     // User has cloud poster with timestamp 1000
     // User creates anonymous poster with timestamp 2000
     // User signs in

     const cloud_poster = '/+16282281824/posters/1000'
     const anon_poster = '/+/posters/2000'

     // Mock cloud has poster
     vi.spyOn(itemid, 'load_from_network').mockResolvedValueOnce(
       '<svg>cloud poster</svg>'
     )

     // Local anonymous poster
     await set(anon_poster, '<svg>anonymous poster</svg>')
     await set('/+/posters/', { items: [2000] })

     await sync_offline_actions()
     await sync_posters_directory()

     const posters = await list(`/+16282281824/posters`)

     // Should have both, no duplicates
     expect(posters.length).toBe(2)
     expect(posters.map(p => as_created_at(p.id)).sort()).toEqual([1000, 2000])
   })
   ```

6. **Clean sign-out and re-sign-in**

   ```javascript
   it('Handles sign-out followed by sign-in with different account', async () => {
     // User 1 signs in, creates poster, signs out
     localStorage.me = '/+16282281824'
     const poster_id = '/+16282281824/posters/1000'
     await set(poster_id, '<svg>user 1 poster</svg>')

     clear_current_user()
     localStorage.me = '/+'

     // User 2 signs in
     setup_current_user({ phoneNumber: '+19171234567' })
     localStorage.me = '/+19171234567'

     const user_1_poster = await get(poster_id)
     const user_2_posters = await list('/+19171234567/posters')

     // User 1's poster should still exist
     expect(user_1_poster).toBeDefined()

     // User 2 should have empty poster list
     expect(user_2_posters.length).toBe(0)
   })
   ```

7. **Anonymous delete queued, then sign-in**

   ```javascript
   it('Properly handles queued delete of anonymous item after sign-in', async () => {
     const anonymous_id = '/+/posters/123'

     // Create and queue delete while offline/anonymous
     await set(anonymous_id, '<svg>poster</svg>')
     await set('sync:offline', [{ id: anonymous_id, action: 'delete' }])

     // User signs in
     setup_current_user()
     localStorage.me = '/+16282281824'

     await sync_offline_actions()

     // Should delete locally, not attempt cloud delete
     expect(await get(anonymous_id)).toBeUndefined()

     // Should not exist in user's cloud storage
     const user_poster = await get('/+16282281824/posters/123')
     expect(user_poster).toBeUndefined()
   })
   ```

### Integration Test Scenarios

8. **Full sign-in flow end-to-end**

   ```javascript
   describe('Complete sign-in flow', () => {
     it('Handles complete user journey from anonymous to authenticated', async () => {
       // 1. Anonymous user creates content
       localStorage.me = '/+'
       const poster_1 = '/+/posters/1000'
       const statement_1 = '/+/statements/2000'

       await set(poster_1, '<svg>anonymous poster</svg>')
       await set(statement_1, '<div>anonymous statement</div>')
       await set('/+/posters/', { items: [1000] })

       // 2. User attempts to save while offline
       await set('sync:offline', [{ id: statement_1, action: 'save' }])

       // 3. User signs in
       setup_current_user()
       localStorage.me = '/+16282281824'

       // 4. Sync runs
       await sync_offline_actions()

       // 5. Verify migration
       expect(await get(poster_1)).toBeUndefined()
       expect(await get(statement_1)).toBeUndefined()
       expect(await get('/+16282281824/posters/1000')).toBeDefined()
       expect(await get('/+16282281824/statements/2000')).toBeDefined()

       // 6. Create new authenticated content
       const poster_2 = '/+16282281824/posters/3000'
       await new Poster(poster_2).save(/* DOM element */)

       // 7. Verify cloud save attempted for authenticated content
       const upload_spy = vi.spyOn(serverless, 'upload')
       expect(upload_spy).toHaveBeenCalled()
     })
   })
   ```

## Test Organization

### Recommended Structure

```
tests/
├── persistance/
│   ├── Cloud.spec.js
│   │   ├── ✅ Basic cloud operations
│   │   └── ❌ ADD: Anonymous item guards
│   ├── Offline.spec.js (new)
│   │   ├── ID transformation
│   │   ├── Cloud save integration
│   │   └── Error handling
│   └── Storage.spec.js
│
├── use/
│   └── sync.spec.js
│       ├── ✅ sync_offline_actions
│       ├── ❌ ADD: Edge cases
│       └── ❌ ADD: Full integration flow
│
└── integration/
    └── sign-in-sync.spec.js (new)
        ├── Complete user journeys
        ├── Error recovery scenarios
        └── Multi-user scenarios
```

## Priority Order

### P0 - Critical (Block Release)

1. Delete anonymous item after sign-in
2. Save anonymous item after sign-in
3. Multiple anonymous posters migration

### P1 - Important (Should Have)

4. Partial migration failure recovery
5. Sign-in with existing cloud data
6. Anonymous delete queued, then sign-in

### P2 - Nice to Have

7. Clean sign-out and re-sign-in
8. Full integration flow

## Running Tests

```bash
# Run all sync-related tests
npm test -- sync

# Run specific test file
npm test tests/components/sync.spec.js

# Run with coverage
npm test -- --coverage
```

## Notes

- Current tests mock `current_user.value` via `setup_current_user()` helper
- IndexedDB operations use `idb-keyval` which is mocked in tests
- Firebase operations are mocked via `@/utils/serverless` mocks
- Tests use `vi.spyOn()` to verify cloud operations are/aren't called
- Real DOM elements needed for some Storage tests - use `document.createElement()`

# Sync Test Failures Analysis

## Summary

19 of 47 sync-related tests are failing. The failures fall into three categories:

1. **Component API mismatch** - Tests written for Options API, component now uses Composition API
2. **Mock misalignment** - Test mocks don't match real implementation behavior
3. **DOM setup issues** - Tests expecting DOM elements that aren't created in test environment

## Failure Categories

### Category 1: Component API Mismatch (5 failures)

**Root Cause:** `src/components/sync.vue` was refactored from Options API to Composition API with `<script setup>`. Tests still expect old structure.

#### Failed Tests

```
✗ Watchers > statement > Triggered when statement is set
✗ Watchers > person > Triggered when statement is set
✗ Methods > #visibility_change > Plays the sync when app becomes visible
✗ Methods > #visibility_change > Is chill when the UI is hidden
✗ @/use/sync > methods > #visit > [4 tests]
```

**Before (what tests expect):**

```vue
<script>
  export default {
    methods: {
      play() { ... },
      visibility_change() { ... }
    },
    watch: {
      statement() { ... },
      person() { ... }
    }
  }
</script>
```

**After (current implementation):**

```vue
<script setup>
  import { use as use_sync } from '@/use/sync'
  // All logic moved to composables
  const { events, sync_element: sync, sync_poster } = use_sync()
</script>
```

**Fix Required:**
Tests need to:

1. Import and test `use_sync` composable directly instead of component methods
2. Remove tests for component-level methods that no longer exist
3. Test composition behavior rather than Options API lifecycle

---

### Category 2: Mock Misalignment (8 failures)

**Root Cause:** Test mocks for `Offline` class and `Cloud` mixin don't match actual implementation, especially after recent fix for `/+/` guard.

#### Failed Tests

```
✗ #sync_offline_actions > Processes anonymous statements from sync:offline queue
✗ #sync_offline_actions > Migrates anonymous posters using Offline class
✗ Offline Storage > Transforms anonymous statement IDs to user IDs
✗ Offline Storage > Transforms anonymous poster IDs to user IDs
✗ Offline Storage > Does not transform already transformed IDs
```

**Current Mock (tests/components/sync.spec.js:34-51):**

```javascript
Offline: class {
  constructor(itemid) {
    if (itemid.startsWith('/+/')) {
      this.id = itemid.replace('/+/', '/+16282281824/')
    } else {
      this.id = itemid
    }
  }
  async save() {
    const data = await get(this.id)
    const parsed_data = data ? JSON.parse(data) : { outerHTML: data }
    const cloud_instance = new (Cloud(Storage))(this.id)
    await cloud_instance.save({ ...parsed_data, id: this.id })
    return Promise.resolve()
  }
}
```

**Problems:**

1. Mock `save()` tries to call `Cloud.save()` but doesn't trigger spy correctly
2. Mock doesn't import real `get()` from idb-keyval in closure
3. Mock doesn't match real `Offline.save()` logic in `src/persistance/Storage.js:78-105`

**Real Implementation:**

```javascript
export class Offline extends Cloud(Storage) {
  async save() {
    const outer_html = await get(this.id)
    if (!outer_html) return

    let { id } = this
    if (id.startsWith('/+/'))
      id = `${localStorage.me}/${as_type(id)}/${as_created_at(id)}`
    if (!is_itemid(id)) {
      console.error('invalid itemid', id)
      return
    }

    const temp_container = document.createElement('div')
    temp_container.innerHTML = outer_html
    const content = temp_container.firstElementChild
    if (content) {
      content.setAttribute('itemid', id)
      content.id = as_query_id(id)
    }

    this.id = id
    await super.save({ outerHTML: temp_container.innerHTML })
  }
}
```

**Fix Required:**
Replace mock with partial mock that uses real implementation:

```javascript
vi.mock('@/persistance/Storage', async () => {
  const actual = await vi.importActual('@/persistance/Storage')
  return {
    ...actual
    // Only override what's necessary for testing
  }
})
```

---

### Category 3: DOM Setup Issues (6 failures)

**Root Cause:** Tests expect DOM elements created by `document.querySelector()` but test environment doesn't have required HTML structure.

#### Failed Tests

```
✗ Hash Comparison Logic Flaw > should reproduce the 9-month gap scenario
✗ Production Bug Scenarios > should reproduce the 9-month gap: [5 variants]
```

**Failing Code (tests/sync-statements.spec.js:140-147):**

```javascript
const elements = mock_sync_element.value.querySelector(
  `[itemid="${mock_itemid}"]`
)

if (!elements || !elements.outerHTML) {
  throw new Error(
    'No local elements found - this would cause sync to return early'
  )
}
```

**Problem:**
`mock_sync_element.value` is a ref but `querySelector` returns `null` because DOM isn't populated.

**Tests Setup (lines 295-297):**

```javascript
const elements = mock_sync_element.value.querySelector(
  `[itemid="${mock_itemid}"]`
)
const hash = await create_hash(elements.outerHTML)
// elements is undefined!
```

**Fix Required:**
Create proper DOM structure in beforeEach:

```javascript
beforeEach(() => {
  // Create actual DOM structure
  mock_sync_element.value = document.createElement('div')
  const statement_div = document.createElement('div')
  statement_div.setAttribute('itemid', mock_itemid)
  statement_div.innerHTML = '<p>Test statement</p>'
  mock_sync_element.value.appendChild(statement_div)
})
```

---

## Detailed Fix Plan

### Priority 1: Fix Mock Alignment (Unblock 8 tests)

**File:** `tests/components/sync.spec.js`

**Changes:**

1. Remove custom `Offline` mock (lines 34-51)
2. Import actual implementation with spy:

   ```javascript
   import { Offline } from '@/persistance/Storage'

   beforeEach(() => {
     // Spy on actual methods instead of mocking whole class
     vi.spyOn(Offline.prototype, 'save')
   })
   ```

3. Ensure `Cloud.to_network()` guard is respected in tests:

   ```javascript
   it('Skips cloud save for anonymous items after fix', async () => {
     setup_current_user()
     const anonymous_id = '/+/posters/123'

     const upload_spy = vi.spyOn(serverless, 'upload')
     const poster = new Poster(anonymous_id)

     // Create DOM element for save
     const element = document.createElement('svg')
     element.setAttribute('itemid', anonymous_id)

     await poster.save(element)

     // Should NOT attempt cloud save due to /+/ guard
     expect(upload_spy).not.toHaveBeenCalled()
   })
   ```

### Priority 2: Fix DOM Setup (Unblock 6 tests)

**File:** `tests/sync-statements.spec.js`

**Changes:**

1. Create proper DOM in setup:

   ```javascript
   let mock_sync_element

   beforeEach(() => {
     mock_sync_element = { value: document.createElement('aside') }

     // Add statement element
     const statement = document.createElement('div')
     statement.setAttribute('itemid', mock_itemid)
     statement.innerHTML = '<p itemProp="statement">Test statement</p>'
     mock_sync_element.value.appendChild(statement)
   })
   ```

2. Update assertions to check for DOM existence:

   ```javascript
   const elements = mock_sync_element.value.querySelector(
     `[itemid="${mock_itemid}"]`
   )

   expect(elements).toBeDefined()
   expect(elements.outerHTML).toBeDefined()
   ```

### Priority 3: Refactor Component Tests (Unblock 5 tests)

**File:** `tests/components/sync.spec.js`

**Strategy:** Test composables directly rather than component wrapper

**Changes:**

1. Remove component-level tests (lines 121-190)
2. Add composable tests:

   ```javascript
   import { use as use_sync } from '@/use/sync'

   describe('@/use/sync composable', () => {
     beforeEach(() => {
       setup_current_user()
     })

     it('Exposes sync methods', () => {
       const { events, sync_element, sync_poster } = use_sync()
       expect(events).toBeDefined()
       expect(sync_element).toBeDefined()
       expect(sync_poster).toBeDefined()
     })

     // Test actual composable behavior
     it('Handles sync lifecycle', async () => {
       // Test sync flow through composable
     })
   })
   ```

3. Fix `vector_mock` reference error (line 265):

   ```javascript
   // Before
   wrapper = shallowMount(vector_mock) // ❌ undefined

   // After
   wrapper = shallowMount(sync, fake_props) // ✅ correct component
   ```

---

## Testing Strategy

### Short Term: Get Tests Passing

1. Fix mocks to match real implementation
2. Add DOM setup where needed
3. Update component tests for Composition API

### Medium Term: Improve Coverage

1. Add missing sign-in threshold tests (see `sign-in-sync-testing.md`)
2. Add tests for `/+/` guard fix
3. Add integration tests

### Long Term: Test Architecture

1. Separate unit tests from integration tests
2. Create test utilities for common setups (DOM, auth, storage)
3. Add E2E tests for critical sync flows

---

## Recommended Execution Order

1. **Fix `tests/components/sync.spec.js` mocks** (30 min)

   - Remove Offline mock
   - Use real implementation with spies
   - Test: `npm test tests/components/sync.spec.js`

2. **Fix `tests/sync-statements.spec.js` DOM setup** (20 min)

   - Add beforeEach DOM creation
   - Update assertions
   - Test: `npm test tests/sync-statements.spec.js`

3. **Remove broken component tests** (15 min)

   - Delete tests for non-existent methods
   - Fix vector_mock reference
   - Test: `npm test -- sync`

4. **Add new tests for `/+/` guard** (45 min)

   - Test Cloud.delete() with anonymous items
   - Test Cloud.to_network() with anonymous items
   - Test: Full sync suite

5. **Add missing integration tests** (2+ hours)
   - Implement Priority 0 tests from `sign-in-sync-testing.md`
   - Full sign-in flow
   - Edge cases

---

## Current Test Status

```
✅ Passing:  28 tests (60%)
❌ Failing:  19 tests (40%)
⏸️  Skipped: 0 tests

Categories:
- Component API:    5 failures (needs refactor)
- Mock alignment:   8 failures (needs fix)
- DOM setup:        6 failures (needs setup)
```

## Success Criteria

**Phase 1 Complete:** All 47 tests passing
**Phase 2 Complete:** +12 new tests for sign-in threshold
**Phase 3 Complete:** +5 integration tests for full flows

**Target:** 64+ tests, 100% passing, <5min runtime
