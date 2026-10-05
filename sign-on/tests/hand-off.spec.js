import { afterEach as after_each, describe, expect, it, vi } from 'vitest'
import { cli_request, hand_off } from '@/utils/hand-off'

const state = 'a'.repeat(32)

describe('cli_request', () => {
  it('accepts an unprivileged port and a long state', () => {
    expect(cli_request({ cli: '53124', state })).toEqual({ port: 53124, state })
  })

  it('rejects a privileged port', () => {
    expect(cli_request({ cli: '80', state })).toBeNull()
  })

  it('rejects a short state', () => {
    expect(cli_request({ cli: '53124', state: 'short' })).toBeNull()
  })

  it('rejects a missing query', () => {
    expect(cli_request(undefined)).toBeNull()
  })
})

describe('hand_off', () => {
  after_each(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('posts the credentials to the waiting port', () => {
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => {})

    hand_off({ port: 53124, state }, { refresh_token: 'r', api_key: 'k' })

    const form = document.querySelector('form')
    expect(form.action).toBe('http://127.0.0.1:53124/callback')
    expect(form.method.toLowerCase()).toBe('post')
    const fields = Object.fromEntries(
      [...form.querySelectorAll('input')].map(input => [input.name, input.value])
    )
    expect(fields).toEqual({ state, refresh_token: 'r', api_key: 'k' })
    expect(submit).toHaveBeenCalledOnce()
  })
})
