import { describe, it, expect } from 'vite-plus/test'
import { cli_request, hand_off } from '@/utils/cli-hand-off'

const state = 'a'.repeat(32)

describe('cli_request', () => {
  it('reads a loopback port and a long state', () => {
    expect(cli_request({ cli: '53124', state })).toEqual({ port: 53124, state })
  })

  it('refuses anything that is not a plain port and state', () => {
    for (const query of [
      undefined,
      {},
      { cli: '53124' },
      { cli: '80', state },
      { cli: '70000', state },
      { cli: 'evil.example', state },
      { cli: '53124/../x', state },
      { cli: '53124', state: 'short' },
      { cli: '53124', state: `${state}"><script>` },
      { cli: ['53124'], state }
    ])
      expect(cli_request(query)).toBeNull()
  })
})

describe('hand_off', () => {
  it('posts state and credentials to 127.0.0.1 only', () => {
    let submitted = null
    const real_submit = HTMLFormElement.prototype.submit
    HTMLFormElement.prototype.submit = function () {
      submitted = this
    }
    try {
      hand_off({ port: 53124, state }, { refresh_token: 'r', api_key: 'k' })
    } finally {
      HTMLFormElement.prototype.submit = real_submit
    }
    expect(submitted.method.toLowerCase()).toBe('post')
    expect(submitted.action).toBe('http://127.0.0.1:53124/callback')
    const fields = Object.fromEntries(
      [...submitted.querySelectorAll('input')].map(i => [i.name, i.value])
    )
    expect(fields).toEqual({ state, refresh_token: 'r', api_key: 'k' })
    submitted.remove()
  })
})
