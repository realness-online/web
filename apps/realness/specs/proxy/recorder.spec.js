import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { it } from 'node:test'
import { agent_service } from '#root/src/proxy/server.js'
import { disk_recorder } from '#root/src/proxy/recorder.js'

const scratch = resolve(
  import.meta.dirname,
  '../../../../artifacts/realness/recorder-tests'
)
const settle = () => new Promise(done => setTimeout(done, 30))

it('each call lands whole on local disk, filed by person and day', async t => {
  await mkdir(scratch, { recursive: true })
  const dir = await mkdtemp(join(scratch, 'traffic-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const server = agent_service({
    identify_phone: async token =>
      token === 'phone.token.signature' ? { phone: '+14155550123' } : null,
    secret: 'model-pass-recorder-test-secret-at-least-thirty-two-bytes',
    key: 'test-key',
    recorder: disk_recorder(dir),
    fetcher: async () =>
      new Response('data: hello\n\ndata: done\n', {
        headers: { 'content-type': 'text/event-stream' }
      })
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => new Promise(done => server.close(done)))
  const url = `http://127.0.0.1:${server.address().port}`
  const reply = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer phone.token.signature' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })
  })
  assert.equal(await reply.text(), 'data: hello\n\ndata: done\n')
  await settle()
  const days = await readdir(join(dir, '+14155550123'))
  assert.equal(days.length, 1)
  assert.match(days[0], /^\d{4}-\d{2}-\d{2}\.jsonl$/)
  const [line] = (await readFile(join(dir, '+14155550123', days[0]), 'utf8'))
    .trim()
    .split('\n')
  const entry = JSON.parse(line)
  assert.equal(entry.messages, undefined)
  assert.deepEqual(entry.request.messages, [{ role: 'user', content: 'hi' }])
  assert.equal(entry.response, 'data: hello\n\ndata: done\n')
  assert.equal(entry.status, 200)
})

it('the local stack records the proxy into artifacts, never into sync', async () => {
  const { local_plan } = await import('#root/src/command/local-stack.js')
  const { out_path, sync_dir } = await import('#root/src/settings/output.js')
  const proxy = local_plan().services.find(service => service.name === 'proxy')
  const at = proxy.args.indexOf('--record')
  assert.equal(proxy.args[at + 1], out_path('proxy-traffic'))
  assert.ok(!proxy.args[at + 1].startsWith(sync_dir()))
})
