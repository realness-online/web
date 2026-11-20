import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const skills_root = join(root, '.pi/skills')

/** Skills Scott types. Every other skill must load from a plain request. */
export const MENU = ['planning', 'soundness', 'tutor', 'vault', 'zoom-to-ableton']

const TRIGGERS = [
  'use when',
  'use for',
  'use to',
  'use on',
  'use before',
  'use after',
  'when asked',
  'when the user',
  'trigger',
  'invoke'
]

/** @param {string} markdown */
const description_of = markdown => {
  const front = markdown.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const block = front.match(/^description:[ \t]*(?:[|>]-?)?[ \t]*\n?((?:[ \t]+.*\n?)+)/m)?.[1] ?? ''
  return block.replace(/\s+/g, ' ').trim()
}

export const skill_descriptions = () =>
  readdirSync(skills_root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      description: description_of(readFileSync(join(skills_root, entry.name, 'SKILL.md'), 'utf8'))
    }))

it('every hidden skill names what a person would say to reach it', () => {
  const hidden = skill_descriptions().filter(skill => !MENU.includes(skill.name))
  assert.ok(hidden.length > 0, 'no hidden skills found')
  const missing = hidden
    .filter(skill => !TRIGGERS.some(token => skill.description.toLowerCase().includes(token)))
    .map(skill => skill.name)
  assert.deepEqual(missing, [], 'hidden skills with no trigger phrase')
})

it('every hidden skill carries a quoted phrase to match against', () => {
  const hidden = skill_descriptions().filter(skill => !MENU.includes(skill.name))
  const missing = hidden.filter(skill => !/"[^"]+"/.test(skill.description)).map(skill => skill.name)
  assert.deepEqual(missing, [], 'hidden skills with no quoted request')
})
