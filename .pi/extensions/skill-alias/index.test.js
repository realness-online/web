import { test } from 'node:test'
import assert from 'node:assert/strict'
import register, { as_skill_command, skill_names } from './index.js'

const commands = [
  { name: 'skill:planning', source: 'skill' },
  { name: 'skill:critic', source: 'skill' },
  { name: 'skill:memory', source: 'skill' },
  { name: 'memory', source: 'extension' }
]

test('skill names skip any a real command already holds', () => {
  assert.deepEqual(skill_names(commands), ['planning', 'critic'])
})

test('a short skill command becomes the full one, arguments kept', () => {
  const names = skill_names(commands)
  assert.equal(as_skill_command('/planning', names), '/skill:planning')
  assert.equal(as_skill_command('/planning a garden plan', names), '/skill:planning a garden plan')
  assert.equal(as_skill_command('/skill:critic', names), '/skill:critic')
})

test('anything else stays plain text', () => {
  const names = skill_names(commands)
  assert.equal(as_skill_command('/memory', names), null)
  assert.equal(as_skill_command('/new', names), null)
  assert.equal(as_skill_command('plan my week', names), null)
  assert.equal(as_skill_command('/etc/hosts is odd', names), null)
})

test('each skill gets a short command that sends the full one', async () => {
  const handlers = {}
  const registered = {}
  const sent = []
  register({
    on: (event, handler) => (handlers[event] = handler),
    getCommands: () => commands,
    registerCommand: (name, options) => (registered[name] = options),
    sendUserMessage: (text, options) => sent.push([text, options])
  })
  handlers.session_start()
  assert.deepEqual(Object.keys(registered), ['planning', 'critic'])
  await registered.planning.handler('a garden plan')
  assert.deepEqual(sent, [['/skill:planning a garden plan', { expandPromptTemplates: true }]])
})
