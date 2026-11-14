import assert from 'node:assert/strict'
import { it } from 'node:test'
import { scout_probe } from '#root/src/scouts/probe.js'
import { GIB } from '#root/lib/units.js'

/** A halo with a jar, and nothing else a probe needs. */
const halo_of = ({ cookies = [{ name: '_sso.key' }], jars = true } = {}) => {
  const calls = []
  return {
    calls,
    store: { free_bytes: () => 8 * GIB },
    jars: jars
      ? {
          load: async (owner, site) => {
            calls.push(`jar ${owner} ${site}`)
            return cookies
          }
        }
      : null
  }
}

it('a probe passes when the halo holds a saved login', async () => {
  const halo = halo_of()
  const result = await scout_probe(halo, '14155551234')
  assert.deepEqual(result, { free: 8 * GIB, cookies: 1 })
  assert.deepEqual(halo.calls, ['jar 14155551234 yc'])
})

it('no saved login stops the probe before any run starts', async () => {
  const halo = halo_of({ cookies: [] })
  await assert.rejects(scout_probe(halo, '14155551234'), /no saved yc login/)
})

it('a halo with no jars at all stops the probe too', async () => {
  const halo = halo_of({ jars: false })
  await assert.rejects(scout_probe(halo, '14155551234'), /no saved yc login/)
})
