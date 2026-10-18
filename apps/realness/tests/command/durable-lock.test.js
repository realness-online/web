import { test } from 'node:test'
import assert from 'node:assert/strict'
import { current } from '../../frontend/durable-lock.js'
import { fileURLToPath as file_url_to_path } from 'node:url'

const frontend = file_url_to_path(new URL('../../frontend/', import.meta.url))

test('durable pin rejects directories inside a parent Git checkout', () => {
  const result = current({ fork: frontend, adapter: frontend })
  assert.match(result.problem, /fork has no independent Git checkout/)
})

test('durable pin reports missing checkouts before reading Git metadata', () => {
  const result = current({
    fork: `${frontend}/missing-checkout`,
    adapter: frontend
  })
  assert.match(result.problem, /fork checkout missing/)
})
