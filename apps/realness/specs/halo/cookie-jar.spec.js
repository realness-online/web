import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import { ChromeLeases } from '../../src/halo/chrome-leases.js'
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

it('a leased copy starts with the site cookies and saves what it has on return', async () => {
  const root = scratch()
  const jars = cookie_jars(root)
  await jars.save('+14155550123', 'yc', [CORP])
  const cookies = fake_cookies()
  const leases = new ChromeLeases(fake_pool(), {
    firewall: { open() {}, close() {} },
    jars,
    cookies
  })
  const lease = await leases.lease('a-1', '172.16.4.2', {
    site: 'yc',
    owner: '+14155550123'
  })
  assert.equal(lease.devtools, 'http://172.19.1.2:9222')
  assert.deepEqual(cookies.kept.get('http://172.19.1.2:9222'), [CORP])
  cookies.kept.set('http://172.19.1.2:9222', [
    CORP,
    { ...CORP, name: 'fresh_login' }
  ])
  await leases.give_back('a-1')
  assert.deepEqual(await jars.load('+14155550123', 'yc'), [
    CORP,
    { ...CORP, name: 'fresh_login' }
  ])
  rmSync(root, { recursive: true, force: true })
})

it('a lease with no site touches no jar', async () => {
  const root = scratch()
  const cookies = fake_cookies()
  const leases = new ChromeLeases(fake_pool(), {
    firewall: { open() {}, close() {} },
    jars: cookie_jars(root),
    cookies
  })
  await leases.lease('a-1', '172.16.4.2')
  assert.equal(cookies.kept.size, 0)
  await leases.give_back('a-1')
  assert.equal(cookies.kept.size, 0)
  rmSync(root, { recursive: true, force: true })
})
