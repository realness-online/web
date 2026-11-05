import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pi_ready } from '#root/src/halo/actors.js'

const capture = readFileSync(
  join(import.meta.dirname, '../app/terminal/capture/pi.tui'),
  'latin1'
)

test('Pi is ready once its footer draws, whatever the model', () => {
  assert.equal(pi_ready(capture), true)
  assert.equal(
    pi_ready(capture.replace(/deepseek[\w/.-]*/g, 'any-model')),
    true
  )
})

test('the shell echoing the opener is not Pi', () => {
  assert.equal(pi_ready('# realness\r\nrealness standard house\r\n'), false)
})
