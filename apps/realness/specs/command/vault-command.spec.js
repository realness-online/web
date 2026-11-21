import assert from 'node:assert/strict'
import { it } from 'node:test'
import { run_vault } from '#root/src/command/vault-command.js'
import { hits_html, note_html } from '#root/src/sync/vault-items.js'

const ask = async (args, reply = note_html({ path: 'x.md', text: 'body' })) => {
  const seen = []
  let out = ''
  await run_vault(args, {
    stdout: { write: chunk => (out += chunk) },
    url: async () => 'http://sync/',
    issue: async () => 'pass',
    fetcher: async (address, init) => {
      seen.push({ address: new URL(address), init })
      return new Response(reply, { status: 200 })
    }
  })
  return { seen, out }
}

it('note reads the path it names, with or without --json', async () => {
  for (const args of [
    ['note', 'Projects/realness.md'],
    ['note', 'Projects/realness.md', '--json'],
    ['--json', 'note', 'Projects/realness.md']
  ]) {
    const { seen } = await ask(args)
    assert.equal(seen[0].address.pathname, '/v1/vault/note', args.join(' '))
    assert.equal(
      seen[0].address.searchParams.get('path'),
      'Projects/realness.md'
    )
    assert.equal(seen[0].init.headers.authorization, 'Bearer pass')
  }
})

it('search sends its words and limit, and --limit never joins the words', async () => {
  const { seen } = await ask(['search', 'release', 'train', '--limit', '3'])
  assert.equal(seen[0].address.pathname, '/v1/vault/search')
  assert.equal(seen[0].address.searchParams.get('q'), 'release train')
  assert.equal(seen[0].address.searchParams.get('limit'), '3')
})

it('search without --limit keeps its first word', async () => {
  const { seen } = await ask(['search', 'release'])
  assert.equal(seen[0].address.searchParams.get('q'), 'release')
})

it('m3: note prints its text, and search prints each hit', async () => {
  assert.equal((await ask(['note', 'x.md'])).out, 'body')
  const hits = hits_html([
    { path: 'Projects/a.md', title: 'A', text: 'a **train**' }
  ])
  assert.equal(
    (await ask(['search', 'train'], hits)).out,
    'Projects/a.md\n  a **train**\n'
  )
  assert.equal((await ask(['search', 'none'], '')).out, 'no notes match\n')
})

it('no verb or no words is the usage', async () => {
  for (const args of [[], ['note'], ['search', '--json'], ['list', 'x']])
    await assert.rejects(ask(args), /usage: realness vault/, args.join(' '))
})
