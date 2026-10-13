/**
 * The contract against a real bucket. Skipped unless GCS_TEST_BUCKET is set:
 *
 *   npm run test:gcs     realness-development, under brayness-test/<run>/
 *
 * Every run writes under its own prefix and deletes it afterwards.
 */
import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { contract } from "../../../src/can/contract.js"
import { create_gcs, gcloud_token } from "../../../src/can/gcs.js"

const bucket = process.env.GCS_TEST_BUCKET
const run = `brayness-test/${randomUUID()}/`
const token = gcloud_token()
const notes = "# Notes\n\n" + "A line that repeats, the way markdown notes do.\n".repeat(50)

/** Records uploads instead of sending them. */
const fake_fetch = (t) => {
  const calls = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({ generation: "1" }))
  })
  return calls
}

test("text is uploaded gzip, marked with contentEncoding", async (t) => {
  const calls = fake_fetch(t)
  await create_gcs({ bucket: "b", token: async () => "t" }).put("people/+1/notes.md", notes)
  assert.match(calls[0].url, /[?&]contentEncoding=gzip(&|$)/)
  assert.equal(gunzipSync(calls[0].init.body).toString("utf8"), notes)
})

test("binary keys and tiny text are uploaded as given", async (t) => {
  const calls = fake_fetch(t)
  const store = create_gcs({ bucket: "b", token: async () => "t" })
  const bytes = Buffer.from(notes)
  await store.put("people/+1/b.bin", bytes)
  await store.put("people/+1/a.md", "hi")
  for (const { url } of calls) assert.doesNotMatch(url, /contentEncoding/)
  assert.equal(calls[0].init.body, bytes)
  assert.equal(calls[1].init.body, "hi")
})

if (!bucket) {
  test("gcs contract (set GCS_TEST_BUCKET to run)", { skip: true }, () => {})
} else {
  after(async () => {
    const auth = { authorization: `Bearer ${await token()}` }
    const api = `https://storage.googleapis.com/storage/v1/b/${bucket}/o`
    const listed = await (await fetch(`${api}?prefix=${encodeURIComponent(run)}`, { headers: auth })).json()
    await Promise.all(
      (listed.items ?? []).map((item) =>
        fetch(`${api}/${encodeURIComponent(item.name)}`, { method: "DELETE", headers: auth }),
      ),
    )
  })

  contract({
    test,
    assert,
    make: async () => create_gcs({ bucket, token, prefix: `${run}${randomUUID()}/` }),
  })

  test("text is stored gzip and reads back plain", async () => {
    const folder = `${run}${randomUUID()}/`
    const store = create_gcs({ bucket, token, prefix: folder })
    await store.put("people/+1/notes.md", notes)
    await store.put("people/+1/b.bin", Buffer.from(notes))
    const meta = async (key) => {
      const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(folder + key)}?fields=contentEncoding,size`
      return (await fetch(url, { headers: { authorization: `Bearer ${await token()}` } })).json()
    }
    const text = await meta("people/+1/notes.md")
    assert.equal(text.contentEncoding, "gzip")
    assert.ok(Number(text.size) < Buffer.byteLength(notes), `stored ${text.size} of ${Buffer.byteLength(notes)}`)
    assert.equal((await meta("people/+1/b.bin")).contentEncoding, undefined)
    assert.equal((await store.get("people/+1/notes.md")).body.toString("utf8"), notes)
    assert.deepEqual((await store.get("people/+1/b.bin")).body, Buffer.from(notes))
  })

  test("the prefix fences every key", async () => {
    const outer = create_gcs({ bucket, token, prefix: run })
    const inner = create_gcs({ bucket, token, prefix: `${run}inner/` })
    await inner.put("people/+1/a.md", "fenced")
    assert.deepEqual(await outer.list("inner/people/+1/"), { files: ["a.md"], folders: [] })
    assert.equal(await inner.get("../a.md"), null)
  })
}
