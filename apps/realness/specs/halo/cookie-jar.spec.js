import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import {
  cookie_jars,
  jar_page,
  read_jar,
  site_of
} from '../../src/halo/cookie-jar.js'

const CORP = {
  name: 'corp_session',
  value: 'abc',
  domain: '.workatastartup.com',
  path: '/',
  expires: 1_900_000_000,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax'
}

const scratch = () => mkdtempSync(out_path('cookie-jar-'))

const fake_pool = () => {
  let n = 0
  return {
    async restore() {
      n += 1
      return {
        n,
        address: `172.19.${n}.2`,
        devtools: `http://172.19.${n}.2:9222`
      }
    },
    async destroy() {}
  }
}

/** A DevTools stand-in: each address keeps its own cookies. */
const fake_cookies = () => {
  const kept = new Map()
  return {
    kept,
    get: async address => kept.get(address) ?? [],
    set: async (address, cookies) => kept.set(address, cookies)
  }
}

it('a jar page reads back the cookies it wrote', () => {
  assert.deepEqual(read_jar(jar_page('yc', [CORP])), [CORP])
})

it('a jar page holds nothing a page cannot read back', () => {
  assert.deepEqual(read_jar('<!doctype html><title>empty</title>'), [])
})

it('a site is a slug, so no jar path escapes its folder', () => {
  assert.equal(site_of('yc'), 'yc')
  assert.throws(() => site_of('../secrets'))
  assert.throws(() => site_of('a/b'))
})

it('a jar root never sits inside a vault that syncs', () => {
  assert.throws(
    () => cookie_jars('/home/person/Desktop/Realness/vault/cookie-jars'),
    /outside the vault/
  )
  assert.throws(() => cookie_jars('vault'), /outside the vault/)
  assert.equal(
    typeof cookie_jars('/opt/fc/actors/mnt/cookie-jars').load,
    'function'
  )
})

it('a saved jar is a page only its owner can read', async () => {
  const root = scratch()
  const jars = cookie_jars(root)
  await jars.save('+14155550123', 'yc', [CORP])
  const file = join(root, '+14155550123/yc.html')
  assert.deepEqual(await jars.load('+14155550123', 'yc'), [CORP])
  assert.equal(statSync(file).mode & 0o777, 0o600)
  assert.deepEqual(await jars.load('+14155550123', 'swooped'), [])
  rmSync(root, { recursive: true, force: true })
})

it('a jar refuses an owner that is not a verified number', async () => {
  await assert.rejects(
    cookie_jars('/nowhere').load('not-an-owner', 'yc'),
    /verified owner/
  )
})

it('a jar keeps cookies across reads', async () => {
  const root = scratch()
  const jars = cookie_jars(root)
  await jars.save('+14155550123', 'yc', [CORP])
  assert.deepEqual(await jars.load('+14155550123', 'yc'), [CORP])
  rmSync(root, { recursive: true, force: true })
})
