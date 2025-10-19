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
