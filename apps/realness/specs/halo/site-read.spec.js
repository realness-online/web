import assert from 'node:assert/strict'
import { it } from 'node:test'
import { address_of, site_read } from '#root/src/halo/site-read.js'

const halo_of = ({ html = '<title>ok</title>', status = 200 } = {}) => {
  const calls = []
  return {
    calls,
    chrome: {
      lease: async (id, ip, options) => {
        calls.push(`lease ${id} ${ip} ${options.site}`)
        return { devtools: 'http://172.19.1.2:9222' }
      },
      give_back: async id => calls.push(`back ${id}`)
    },
    html,
    status
  }
}

const actor = {
  id: 'a-1',
  owner: '+14155551234',
  actor_ip: '172.19.0.2',
  site: 'yc'
}

it('a site read leases with its jar and gives the copy back', async () => {
  const halo = halo_of()
  const page = await site_read(
    halo,
    actor,
    'https://example.com/',
    async (address, url) => {
      assert.equal(address, '172.19.1.2')
      assert.equal(url, 'https://example.com/')
      return { status: halo.status, html: halo.html }
    }
  )
  assert.deepEqual(page, { status: 200, html: '<title>ok</title>', site: 'yc' })
  assert.deepEqual(halo.calls, ['lease a-1 172.19.0.2 yc', 'back a-1'])
})

it('a site read asks for content, not the load event', async () => {
  const halo = halo_of()
  let asked = null
  await site_read(
    halo,
    actor,
    'https://example.com/',
    async (a, u, options) => {
      asked = options
      return { status: 200, html: 'ok' }
    }
  )
  assert.deepEqual(asked, { wait: 'content', settle_ms: 20_000 })
})

it('a read that throws still gives the copy back', async () => {
  const halo = halo_of()
  await assert.rejects(
    site_read(halo, actor, 'https://example.com/', async () => {
      throw new Error('no DevTools on 172.19.1.2:9222 after 15s')
    }),
    /no DevTools/
  )
  assert.deepEqual(halo.calls, ['lease a-1 172.19.0.2 yc', 'back a-1'])
})

it('a lease url becomes the bare address a render takes', () => {
  assert.equal(address_of('http://172.19.3.2:9222'), '172.19.3.2')
})
