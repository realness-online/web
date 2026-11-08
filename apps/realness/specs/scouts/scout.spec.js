import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import {
  find_scout,
  read_scout,
  scout_page,
  scout_pages
} from '#root/src/scouts/scout.js'

const FIELDS = {
  itemid: '/+1/scouts/1',
  org: '+1',
  schedule: 'once a day',
  minutes: 30,
  per_day: 4,
  status: 'active'
}

/** A vault with the plan folders named, each holding a scout page. */
const vault_of = async names => {
  const root = await mkdtemp(join(tmpdir(), 'scout-pages-'))
  for (const name of names) {
    const folder = join(root, 'vault', 'Projects', name)
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'scout.html'), scout_page(name, FIELDS))
  }
  return root
}

it('reads a scout page as its fields and its numbers', () => {
  const item = read_scout(scout_page('Realness', FIELDS))
  assert.deepEqual(item, {
    itemid: '/+1/scouts/1',
    org: '+1',
    schedule: 'once a day',
    minutes: '30',
    per_day: '4',
    status: 'active'
  })
  assert.equal(read_scout('<!doctype html>'), null)
})

it('finds every scout below Projects at any depth, in folder order', async () => {
  const root = await vault_of(['Realness', 'Scouts/Realness', 'Scouts/SMS'])
  const pages = scout_pages(join(root, 'vault'))
  assert.deepEqual(
    pages.map(page => page.path),
    ['Realness', 'Scouts/Realness', 'Scouts/SMS']
  )
  assert.equal(pages[1].minutes, 30)
  assert.equal(pages[1].status, 'active')
  await rm(root, { recursive: true })
})

it('a folder with no scout.html is not a scout', async () => {
  const root = await vault_of(['Realness'])
  await mkdir(join(root, 'vault', 'Projects', 'Clients'), { recursive: true })
  assert.deepEqual(
    scout_pages(join(root, 'vault')).map(page => page.path),
    ['Realness']
  )
  await rm(root, { recursive: true })
})

it('finds one scout by path or by name, and never guesses between two', async () => {
  const root = await vault_of(['Realness', 'Scouts/Realness', 'Scouts/SMS'])
  const pages = scout_pages(join(root, 'vault'))
  assert.equal(find_scout(pages, 'Scouts/realness/').path, 'Scouts/Realness')
  assert.equal(find_scout(pages, 'Scouts/SMS/scout.html').path, 'Scouts/SMS')
  assert.throws(() => find_scout(pages, 'realness'), /two scouts are named/)
  assert.throws(
    () => find_scout(pages, 'nope'),
    /try Realness, Scouts\/Realness/
  )
  await rm(root, { recursive: true })
})

it('an empty vault says so instead of naming nothing', () => {
  assert.throws(
    () => find_scout([], 'realness'),
    /the vault holds no scout\.html/
  )
})
