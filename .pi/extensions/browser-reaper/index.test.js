import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyBrowserEnv, IDLE_TIMEOUT_MS } from './index.js'

describe('applyBrowserEnv', () => {
  it('sets a per-process session and idle timeout', () => {
    const env = {}
    assert.equal(applyBrowserEnv(env, 42), 'pi-42')
    assert.equal(env.AGENT_BROWSER_IDLE_TIMEOUT_MS, IDLE_TIMEOUT_MS)
  })
  it('keeps values already set', () => {
    const env = { AGENT_BROWSER_SESSION: 'x', AGENT_BROWSER_IDLE_TIMEOUT_MS: '5' }
    assert.equal(applyBrowserEnv(env, 42), 'x')
    assert.equal(env.AGENT_BROWSER_IDLE_TIMEOUT_MS, '5')
  })
})
