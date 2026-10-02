import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { admin_login } from "../src/auth.js"

for (const status of [200, 403]) {
  test(`admin login checks sync before saving credentials: ${status}`, async (t) => {
    let checked = false
    const server = createServer((request, response) => {
      assert.equal(request.headers.authorization, "Bearer test-token")
      checked = true
      response.writeHead(status, { "content-type": "application/json" })
      response.end(status === 200 ? JSON.stringify({ files: [], folders: [] }) : "{}")
    })
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    t.after(() => server.close())
    const saved = []
    const credentials = { refresh_token: "secret", api_key: "key" }
    const promise = admin_login("dev", {
      url: `http://127.0.0.1:${server.address().port}`,
      store: { write: async (value) => { assert.ok(checked); saved.push(value) } },
      sign_in: async ({ store }) => {
        await store.write(credentials)
        return { id_token: "test-token" }
      },
    })
    if (status === 403) {
      await assert.rejects(promise)
      assert.deepEqual(saved, [])
    } else {
      assert.equal((await promise).admin, true)
      assert.deepEqual(saved, [credentials])
    }
  })
}
