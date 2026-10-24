import { it } from 'node:test'
import assert from 'node:assert/strict'
import { current } from '../../durable-lock.js'
import { fileURLToPath as file_url_to_path } from 'node:url'

const frontend = file_url_to_path(new URL('../../', import.meta.url))

it('durable pin rejects directories inside a parent Git checkout', () => {
  const result = current({ fork: frontend, adapter: frontend })
  assert.match(result.problem, /fork has no independent Git checkout/)
})

it('durable pin reports missing checkouts before reading Git metadata', () => {
  const result = current({
    fork: `${frontend}/missing-checkout`,
    adapter: frontend
  })
  assert.match(result.problem, /fork checkout missing/)
})
