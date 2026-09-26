/**
 * The contract every adapter passes. Each adapter's test calls:
 *
 *   contract({ test, assert, make })   make() resolves to a fresh, empty store
 *
 * Keys are relative, `/`-separated; versions are opaque strings.
 */
export function contract({ test, assert, make }) {
  const text = (file) => file?.body.toString("utf8")

  test("a missing key reads as null", async () => {
    const store = await make()
    assert.equal(await store.get("people/+1/none.md"), null)
  })

  test("put then get returns the bytes and the same version", async () => {
    const store = await make()
    const version = await store.put("people/+1/a.md", "hello")
    const file = await store.get("people/+1/a.md")
    assert.equal(text(file), "hello")
    assert.equal(typeof version, "string")
    assert.equal(file.version, version)
  })

  test("a new write gets a new version", async () => {
    const store = await make()
    const v1 = await store.put("people/+1/a.md", "one")
    const v2 = await store.put("people/+1/a.md", "two")
    assert.notEqual(v1, v2)
  })

  test("if_version null creates only when absent", async () => {
    const store = await make()
    await store.put("people/+1/a.md", "first", { if_version: null })
    await assert.rejects(store.put("people/+1/a.md", "second", { if_version: null }), { code: "conflict" })
    assert.equal(text(await store.get("people/+1/a.md")), "first")
  })

  test("a matching version writes; a stale one conflicts", async () => {
    const store = await make()
    const v1 = await store.put("people/+1/a.md", "one")
    await store.put("people/+1/a.md", "two", { if_version: v1 })
    await assert.rejects(store.put("people/+1/a.md", "three", { if_version: v1 }), { code: "conflict" })
    assert.equal(text(await store.get("people/+1/a.md")), "two")
  })

  test("a version on a missing key conflicts", async () => {
    const store = await make()
    const v1 = await store.put("people/+1/a.md", "one")
    await store.delete("people/+1/a.md")
    await assert.rejects(store.put("people/+1/a.md", "again", { if_version: v1 }), { code: "conflict" })
  })

  test("delete removes; a stale delete conflicts", async () => {
    const store = await make()
    const v1 = await store.put("people/+1/a.md", "one")
    await store.put("people/+1/a.md", "two")
    await assert.rejects(store.delete("people/+1/a.md", { if_version: v1 }), { code: "conflict" })
    await store.delete("people/+1/a.md")
    assert.equal(await store.get("people/+1/a.md"), null)
    await store.delete("people/+1/a.md") // deleting nothing is fine
  })

  test("list shows direct files and folders only", async () => {
    const store = await make()
    await store.put("people/+1/posters/1.html.gz", "p")
    await store.put("people/+1/posters/2.html.gz", "p")
    await store.put("people/+1/posters/deep/3.html.gz", "p")
    await store.put("people/+1/index.html.gz", "i")
    assert.deepEqual(await store.list("people/+1/posters/"), {
      files: ["1.html.gz", "2.html.gz"],
      folders: ["deep"],
    })
    assert.deepEqual(await store.list("people/+1/"), { files: ["index.html.gz"], folders: ["posters"] })
    assert.deepEqual(await store.list("people/"), { files: [], folders: ["+1"] })
    assert.deepEqual(await store.list("people/+2/"), { files: [], folders: [] })
  })

  test("walk maps every file under a prefix to its version", async () => {
    const store = await make()
    const a = await store.put("people/+1/vault/a.md", "a")
    const b = await store.put("people/+1/vault/deep/b.md", "b")
    await store.put("people/+1/other.md", "o")
    assert.deepEqual(await store.walk("people/+1/vault/"), { "a.md": a, "deep/b.md": b })
    assert.deepEqual(await store.walk("people/+2/"), {})
  })

  test("two racing creates: exactly one wins", async () => {
    const store = await make()
    const results = await Promise.allSettled(
      ["one", "two", "three"].map((body) => store.put("pins/+1", body, { if_version: null })),
    )
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
    for (const r of results.filter((r) => r.status === "rejected")) assert.equal(r.reason.code, "conflict")
  })

  test("bytes survive untouched", async () => {
    const store = await make()
    const bytes = Buffer.from([0, 255, 10, 13, 0x1f, 0x8b])
    await store.put("people/+1/b.bin", bytes)
    assert.deepEqual((await store.get("people/+1/b.bin")).body, bytes)
  })
}
