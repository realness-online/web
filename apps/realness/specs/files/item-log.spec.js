import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import { append_item, read_page } from '#root/src/files/item-log.js'

const scratch = async () => mkdtemp(out_path('item-log-'))

it('each append is one gzip member, and the page reads back in order', async t => {
  const dir = await scratch()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const page = join(dir, 'stages.html.gz')
  await append_item(page, 'stage', { at: 1, tool: 'realness-read --site yc' })
  await append_item(page, 'stage', { at: 2, tool: '' })
  const found = await read_page(page, 'stage')
  assert.deepEqual(found, [
    { at: '1', tool: 'realness-read --site yc' },
    { at: '2', tool: '' }
  ])
})

it('a page that was never written is empty, not a failure', async t => {
  const dir = await scratch()
  t.after(() => rm(dir, { recursive: true, force: true }))
  assert.deepEqual(await read_page(join(dir, 'none.html.gz'), 'stage'), [])
})

it('the page is far smaller than the same records as JSON lines', async t => {
  const dir = await scratch()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const page = join(dir, 'calls.html.gz')
  const body = JSON.stringify({
    messages: Array.from({ length: 40 }, (_, at) => ({
      role: at % 2 ? 'assistant' : 'user',
      content: 'Please read https://example.com/page and summarise it.'
    }))
  })
  for (let at = 0; at < 20; at += 1)
    await append_item(page, 'model-call', { at, request: body, response: body })
  const packed = (await stat(page)).size
  const plain = Buffer.byteLength(
    Array.from({ length: 20 }, () =>
      JSON.stringify({ request: body, response: body })
    ).join('\n')
  )
  assert.ok(packed < plain / 10, `packed ${packed} against ${plain}`)
})
