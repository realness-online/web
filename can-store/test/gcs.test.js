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
import { contract } from "../src/contract.js"
import { create_gcs, gcloud_token } from "../src/gcs.js"

const bucket = process.env.GCS_TEST_BUCKET
const run = `brayness-test/${randomUUID()}/`
const token = gcloud_token()

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

  test("the prefix fences every key", async () => {
    const outer = create_gcs({ bucket, token, prefix: run })
    const inner = create_gcs({ bucket, token, prefix: `${run}inner/` })
    await inner.put("people/+1/a.md", "fenced")
    assert.deepEqual(await outer.list("inner/people/+1/"), { files: ["a.md"], folders: [] })
    assert.equal(await inner.get("../a.md"), null)
  })
}
