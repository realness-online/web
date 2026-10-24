import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { load_manifest, verify_file } from '../../scripts/verify-deploy.js'

const digest = bytes =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const scratch = resolve(
  import.meta.dirname,
  '../../../artifacts/verify-deploy-run'
)

let server
let base
const served = {}

before(async () => {
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(scratch, { recursive: true })
  server = createServer((req, res) => {
    const body = served[req.url]
    if (body === undefined) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(body)
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
  rmSync(scratch, { recursive: true, force: true })
})

describe('load_manifest', () => {
  it('reads a local manifesto file and names its source', async () => {
    const file = join(scratch, 'manifest.json')
    writeFileSync(
      file,
      JSON.stringify({ version: '1.0.0', files: { '/a.js': 'sha256:aa' } })
    )
    const { manifest, source } = await load_manifest({
      base_url: base,
      manifest_path: file,
      release: null,
      from_site: false,
      repo: 'r/r'
    })
    assert.equal(manifest.version, '1.0.0')
    assert.equal(source, `file:${file}`)
  })

  it('reads a site manifesto when no release or file is given', async () => {
    served['/build-manifest.json'] = JSON.stringify({
      version: '2.0.0',
      files: {}
    })
    const { manifest, source } = await load_manifest({
      base_url: base,
      manifest_path: null,
      release: null,
      from_site: true,
      repo: 'r/r'
    })
    assert.equal(manifest.version, '2.0.0')
    assert.equal(source, `site:${base}/build-manifest.json`)
    delete served['/build-manifest.json']
  })

  it('says a site without a manifesto cannot be checked', async () => {
    await assert.rejects(
      load_manifest({
        base_url: base,
        manifest_path: null,
        release: null,
        from_site: true,
        repo: 'r/r'
      }),
      /Could not load manifesto from/
    )
  })
})

describe('verify_file', () => {
  it('passes a file whose bytes hash to the manifesto value', async () => {
    served['/a.js'] = 'the built file'
    assert.deepEqual(
      await verify_file(base, '/a.js', digest('the built file')),
      {
        file_path: '/a.js',
        ok: true
      }
    )
    const mismatch = await verify_file(base, '/a.js', digest('other'))
    assert.equal(mismatch.ok, false)
    assert.match(mismatch.message, /expected sha256:/)
    assert.match(mismatch.message, /actual {3}sha256:/)
  })

  it('reports a missing file by its status', async () => {
    assert.deepEqual(await verify_file(base, '/gone.js', digest('x')), {
      file_path: '/gone.js',
      ok: false,
      message: 'HTTP 404'
    })
  })
})
