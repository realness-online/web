import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
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
const emulator_host = process.env.FIREBASE_STORAGE_EMULATOR_HOST
const STORAGE_PORT = emulator_host
  ? Number(emulator_host.split(':').pop())
  : Number(process.env.STORAGE_EMULATOR_PORT || 9439)

const OWNER = '+15551110000'
const STRANGER = '+15552220000'
const files = [
  `people/${OWNER}/index.html.gz`,
  `people/${OWNER}/relations.html.gz`,
  `people/${OWNER}/posters/1712000000000.html.gz`,
  `subscriptions/${OWNER}/endpoint-abc.json`,
  'loose.txt'
]

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
    for (const path of files)
      await uploadString(ref(seed, path), 'seeded', 'raw')
  })
})

describe('m3: no client reaches Firebase Storage', () => {
  it.each(files)('denies every client a read of %s', async path => {
    await assertFails(getBytes(ref(anonymous, path)))
    await assertFails(getBytes(ref(owner, path)))
    await assertFails(getBytes(ref(stranger, path)))
  })

  it('denies writes and deletes, including the owner', async () => {
    const path = files[0]
    await assertFails(uploadString(ref(owner, path), 'mine', 'raw'))
    await assertFails(uploadString(ref(anonymous, path), 'theirs', 'raw'))
    await assertFails(deleteObject(ref(owner, path)))
    await assertFails(deleteObject(ref(stranger, path)))
  })

  it('denies listings', async () => {
    await assertFails(listAll(ref(owner, 'people')))
    await assertFails(listAll(ref(anonymous, `people/${OWNER}/posters`)))
  })
})
