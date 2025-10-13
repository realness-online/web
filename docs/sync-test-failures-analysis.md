# Sync Test Failures Analysis

## Summary

19 of 47 sync-related tests are failing. The failures fall into three categories:

1. **Component API mismatch** - Tests written for Options API, component now uses Composition API
2. **Mock misalignment** - Test mocks don't match real implementation behavior
3. **DOM setup issues** - Tests expecting DOM elements that aren't created in test environment

## Failure Categories

### Category 1: Component API Mismatch (5 failures)

**Root Cause:** `src/components/sync.vue` was refactored from Options API to Composition API with `<script setup>`. Tests still expect old structure.

#### Failed Tests:

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

#### Failed Tests:

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

#### Failed Tests:

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
