import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing'
import {
  ref,
  getBytes,
  uploadString,
  deleteObject,
  listAll
} from 'firebase/storage'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ID = 'realness-rules-test'
const STORAGE_PORT = Number(process.env.STORAGE_EMULATOR_PORT || 9299)

const OWNER = '+15551110000'
const STRANGER = '+15552220000'

const relations = `people/${OWNER}/relations.html.gz`
const profile = `people/${OWNER}/index.html.gz`
const poster = `people/${OWNER}/posters/1712000000000.html.gz`
const statements = `people/${OWNER}/statements/1712000000000.html.gz`
const subscription = `subscriptions/${OWNER}/endpoint-abc`
const archived = `people/${OWNER}/posters/1600000000000/1712000000000.html.gz`
const loose = 'loose.txt'

let test_env
let anonymous
let owner
let stranger

beforeAll(async () => {
  const rules = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8')

  test_env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: { rules, host: '127.0.0.1', port: STORAGE_PORT }
  })

  anonymous = test_env.unauthenticatedContext().storage()
  owner = test_env
    .authenticatedContext('owner-uid', { phone_number: OWNER })
    .storage()
  stranger = test_env
    .authenticatedContext('stranger-uid', { phone_number: STRANGER })
    .storage()
})

afterAll(async () => {
  if (test_env) await test_env.cleanup()
})

beforeEach(async () => {
  await test_env.clearStorage()
  await test_env.withSecurityRulesDisabled(async context => {
    const seed = context.storage()
    const paths = [
      relations,
      profile,
      poster,
      statements,
      subscription,
      archived,
      loose
    ]
    for (const path of paths)
      await uploadString(ref(seed, path), 'seeded', 'raw')
  })
})

describe('relations.html.gz is private', () => {
  it('denies an anonymous read', async () => {
    await assertFails(getBytes(ref(anonymous, relations)))
  })

  it('denies another signed-in person a read', async () => {
    await assertFails(getBytes(ref(stranger, relations)))
  })

  it('allows the owner to read', async () => {
    await assertSucceeds(getBytes(ref(owner, relations)))
  })

  it('allows the owner to write', async () => {
    await assertSucceeds(uploadString(ref(owner, relations), 'mine', 'raw'))
  })

  it('allows the owner to delete', async () => {
    await assertSucceeds(deleteObject(ref(owner, relations)))
  })

  it('denies another signed-in person a write', async () => {
    await assertFails(uploadString(ref(stranger, relations), 'theirs', 'raw'))
  })

  it('denies an anonymous delete', async () => {
    await assertFails(deleteObject(ref(anonymous, relations)))
  })
})

describe('the rest of a person is public to read', () => {
  it('allows an anonymous profile read', async () => {
    await assertSucceeds(getBytes(ref(anonymous, profile)))
  })

  it('allows an anonymous poster read', async () => {
    await assertSucceeds(getBytes(ref(anonymous, poster)))
  })

  it('allows an anonymous read of nested statements', async () => {
    await assertSucceeds(getBytes(ref(anonymous, statements)))
  })

  it('allows another signed-in person a poster read', async () => {
    await assertSucceeds(getBytes(ref(stranger, poster)))
  })
})

describe('only the owner writes their own tree', () => {
  it('allows the owner to write a poster', async () => {
    await assertSucceeds(uploadString(ref(owner, poster), 'mine', 'raw'))
  })

  it('allows the owner to delete a poster', async () => {
    await assertSucceeds(deleteObject(ref(owner, poster)))
  })

  it('denies an anonymous profile write', async () => {
    await assertFails(uploadString(ref(anonymous, profile), 'theirs', 'raw'))
  })

  it('denies another signed-in person a poster write', async () => {
    await assertFails(uploadString(ref(stranger, poster), 'theirs', 'raw'))
  })

  it('denies another signed-in person a poster delete', async () => {
    await assertFails(deleteObject(ref(stranger, poster)))
  })
})

describe('subscriptions never leave their owner', () => {
  it('denies an anonymous read', async () => {
    await assertFails(getBytes(ref(anonymous, subscription)))
  })

  it('denies another signed-in person a read', async () => {
    await assertFails(getBytes(ref(stranger, subscription)))
  })

  it('allows the owner to read', async () => {
    await assertSucceeds(getBytes(ref(owner, subscription)))
  })

  it('allows the owner to write', async () => {
    await assertSucceeds(uploadString(ref(owner, subscription), 'sub', 'raw'))
  })

  it('allows the owner to delete', async () => {
    await assertSucceeds(deleteObject(ref(owner, subscription)))
  })

  it('denies another signed-in person a write', async () => {
    await assertFails(uploadString(ref(stranger, subscription), 'sub', 'raw'))
  })
})

// Listing is its own permission, and the 22 cases this suite started with were
// all gets, writes and deletes. v2.6.6 removed the only rule granting a list of
// `people/` and nothing here noticed.
describe('listing', () => {
  it('lets a signed-in person list the phonebook', async () => {
    await assertSucceeds(listAll(ref(owner, 'people')))
  })

  it('refuses an anonymous listing of the phonebook', async () => {
    await assertFails(listAll(ref(anonymous, 'people')))
  })

  it('lets anyone list a posters folder, signed in or not', async () => {
    await assertSucceeds(listAll(ref(stranger, `people/${OWNER}/posters`)))
    await assertSucceeds(listAll(ref(anonymous, `people/${OWNER}/posters`)))
  })

  it('lets anyone list an archive folder inside posters', async () => {
    await assertSucceeds(
      listAll(ref(anonymous, `people/${OWNER}/posters/1600000000000`))
    )
  })

  it('lets anyone list a statements folder', async () => {
    await assertSucceeds(listAll(ref(anonymous, `people/${OWNER}/statements`)))
  })

  it('refuses an anonymous listing of a person', async () => {
    await assertFails(listAll(ref(anonymous, `people/${OWNER}`)))
  })

  // A person's root is the one path where `{folder}` never binds, so the rule
  // guarding relations.html.gz throws, and that throw is what denies the
  // anonymous listing above. The phonebook grant is a separate match and still
  // allows anybody signed in: revoke it and this listing denies with that same
  // null-value error. Names only; a list never returns bytes.
  it('lets a signed-in person list a person', async () => {
    await assertSucceeds(listAll(ref(stranger, `people/${OWNER}`)))
    await assertSucceeds(listAll(ref(owner, `people/${OWNER}`)))
  })

  it('refuses everyone a listing of the bucket root', async () => {
    await assertFails(listAll(ref(anonymous, '')))
    await assertFails(listAll(ref(owner, '')))
  })
})

// Subscriptions are push endpoints keyed by phone number, so a list here would
// enumerate everybody who has ever turned notifications on.
describe('subscriptions cannot be enumerated', () => {
  it('refuses everyone a listing of subscriptions', async () => {
    await assertFails(listAll(ref(anonymous, 'subscriptions')))
    await assertFails(listAll(ref(owner, 'subscriptions')))
    await assertFails(listAll(ref(stranger, 'subscriptions')))
  })

  it('refuses a stranger a listing of somebody else subscriptions', async () => {
    await assertFails(listAll(ref(stranger, `subscriptions/${OWNER}`)))
    await assertFails(listAll(ref(anonymous, `subscriptions/${OWNER}`)))
  })
})

// Nothing outside people/ and subscriptions/ is reachable at all.
describe('paths outside the tree', () => {
  it('refuses a read and a write to a loose file', async () => {
    await assertFails(getBytes(ref(anonymous, loose)))
    await assertFails(getBytes(ref(owner, loose)))
    await assertFails(uploadString(ref(owner, loose), 'x', 'raw'))
  })
})
