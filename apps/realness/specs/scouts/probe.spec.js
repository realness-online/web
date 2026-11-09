import assert from 'node:assert/strict'
import { it } from 'node:test'
import { scout_probe } from '#root/src/scouts/probe.js'
import { GIB } from '#root/lib/units.js'

const DIRECTORY =
  "<html><head><title>Directory | Y Combinator's Work at a Startup</title></head></html>"

/** A halo whose pool restores and destroys, and whose leases come back. */
const halo_of = ({
  cookies = [{ name: '_sso.key' }],
  rendered = DIRECTORY
} = {}) => {
  const calls = []
  return {
    calls,
    store: { free_bytes: () => 8 * GIB },
    chrome: {
      jars: {
        load: async (owner, site) => {
          calls.push(`jar ${owner} ${site}`)
          return cookies
        }
      },
      lease: async (id, ip, options) => {
        calls.push(`lease ${id} ${ip} ${options.site}`)
        return { devtools: 'http://127.0.0.1:9222' }
      },
      give_back: async id => calls.push(`back ${id}`),
      pool: {
        restore: async () => {
          calls.push('restore')
          return { n: 1 }
        },
        destroy: async n => calls.push(`destroy ${n}`)
      }
    },
    render: async () => rendered
  }
}

const actor = { id: 'box-1', owner: '14155551234', actor_ip: '10.0.0.2' }

it('a probe reads the yc directory through its saved login and gives the copy back', async () => {
  const halo = halo_of()
  const result = await scout_probe(halo, actor, async (address, url) => {
    assert.equal(address, '127.0.0.1')
    assert.equal(url, 'https://www.workatastartup.com/')
    return { status: 200, html: DIRECTORY }
  })
  assert.deepEqual(result, { free: 8 * GIB, status: 200, cookies: 1 })
  assert.deepEqual(halo.calls, [
    'restore',
    'destroy 1',
    'jar 14155551234 yc',
    'lease box-1 10.0.0.2 yc',
    'back box-1'
  ])
})

it('no saved login stops the probe before a copy is leased', async () => {
  const halo = halo_of({ cookies: [] })
  await assert.rejects(scout_probe(halo, actor), /no saved yc login/)
  assert.deepEqual(halo.calls, ['restore', 'destroy 1', 'jar 14155551234 yc'])
})

it('a sign-in page fails the probe, and the copy still goes back', async () => {
  const halo = halo_of()
  await assert.rejects(
    scout_probe(halo, actor, async () => ({
      status: 200,
      html: '<title>Sign in | Y Combinator</title>'
    })),
    /login may have expired/
  )
  assert.equal(halo.calls.at(-1), 'back box-1')
})

it('a read that throws still gives the copy back', async () => {
  const halo = halo_of()
  await assert.rejects(
    scout_probe(halo, actor, async () => {
      throw new Error('DevTools socket failed')
    }),
    /DevTools socket failed/
  )
  assert.equal(halo.calls.at(-1), 'back box-1')
})
