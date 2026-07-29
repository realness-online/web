import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing'
import { ref, getBytes, uploadString, deleteObject } from 'firebase/storage'
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
    const paths = [relations, profile, poster, statements, subscription]
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
