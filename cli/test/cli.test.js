import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createSign, generateKeyPairSync } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { delimiter, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { disk } from "../../can-store/src/disk.js"
import { client } from "../../sync/src/client.js"
import { rights } from "../../sync/src/rights.js"
import { sync_service } from "../../sync/src/server.js"
import { run } from "../src/command.js"
import { CapabilityError, file_capabilities } from "../src/files.js"

const executable = fileURLToPath(new URL("../bin/brayness.js", import.meta.url))
const artifacts = fileURLToPath(new URL("../../../../artifacts/brayness/cli-tests/", import.meta.url))
const project = "brayness-cli-test"
const phone = "+15555550123"
const { privateKey: private_key, publicKey: public_key } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const certs = async () => ({ test: public_key.export({ type: "spki", format: "pem" }) })

function token(claims = {}) {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const header = encode({ alg: "RS256", kid: "test", typ: "JWT" })
  const body = encode({ aud: project, iss: `https://securetoken.google.com/${project}`, sub: "cli-person", phone_number: phone, iat: now - 10, auth_time: now - 10, exp: now + 3600, ...claims })
  const signer = createSign("RSA-SHA256")
  signer.update(`${header}.${body}`)
  return `${header}.${body}.${signer.sign(private_key).toString("base64url")}`
}

async function fixture(t) {
  await mkdir(artifacts, { recursive: true })
  const root = await mkdtemp(join(artifacts, "run-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const storage = disk(join(root, "storage"))
  const server = sync_service({ storage, rights: rights(storage), project, certs, log: () => {} })
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready))
  t.after(() => new Promise((done) => { server.closeAllConnections(); server.close(done) }))
  const url = `http://127.0.0.1:${server.address().port}`
  const bin = join(root, "bin")
  await mkdir(bin)
  await symlink(executable, join(bin, "brayness"))
  const signed_token = token()
  const invoke = (args, overrides = {}) => new Promise((resolve, reject) => {
    const child = spawn("brayness", args, {
      cwd: root,
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, TOKEN: signed_token, SYNC_URL: url, BRAYNESS_STATE: join(root, "state"), ...overrides },
    })
    const out = [], err = []
    child.stdout.on("data", (chunk) => out.push(chunk))
    child.stderr.on("data", (chunk) => err.push(chunk))
    child.on("error", reject)
    child.on("close", (code) => {
      const bytes = Buffer.concat(out)
      resolve({ code, bytes, stdout: bytes.toString(), stderr: Buffer.concat(err).toString() })
    })
  })
  return { root, url, signed_token, storage, server, invoke }
}

function result(output) {
  assert.equal(output.code, 0, output.stderr || output.stdout)
  assert.equal(output.stderr, "")
  const parsed = JSON.parse(output.stdout)
  assert.equal(parsed.ok, true)
  return parsed.result
}

test("public brayness command syncs an edit between two folders through the service", async (t) => {
  const { root, invoke } = await fixture(t)
  const first = join(root, "first folder"), second = join(root, "second folder")
  const name = "note with spaces.txt", remote = "can://~/practice/"
  await mkdir(first)
  await writeFile(join(first, name), "first copy\n")
  assert.deepEqual(result(await invoke(["files", "sync", first, remote, "--json"])).pushed, [name])
  assert.deepEqual(result(await invoke(["files", "cat", remote + name, "--json"])), { path: remote + name, encoding: "utf8", content: "first copy\n" })
  assert.deepEqual(result(await invoke(["files", "sync", second, remote, "--json"])).pulled, [name])
  await writeFile(join(second, name), "saved edit\n")
  assert.deepEqual(result(await invoke(["files", "sync", second, remote, "--json"])).pushed, [name])
  assert.deepEqual(result(await invoke(["files", "sync", first, remote, "--json"])).pulled, [name])
  assert.equal(await readFile(join(first, name), "utf8"), "saved edit\n")
  const unchanged = await invoke(["files", "sync", first, remote])
  assert.equal(unchanged.code, 0)
  assert.equal(unchanged.stdout, "unchanged: 1\n")
})

test("shared file capabilities use the same service without the CLI adapter", async (t) => {
  const { root, url, signed_token } = await fixture(t)
  const folder = join(root, "native")
  await mkdir(folder)
  await writeFile(join(folder, "note.txt"), "native capability\n")
  const store = client({ url, token: signed_token })
  // Keep derived sync records inside this test's artifacts.
  const files = file_capabilities({ store: { ...store, sync: (local, remote) => store.sync(local, remote, { state: join(root, "native-state") }) } })
  assert.deepEqual((await files.sync({ local: folder, remote: "can://~/native/" })).pushed, ["note.txt"])
  assert.equal((await files.read({ path: "can://~/native/note.txt" })).content, "native capability\n")
})

test("JSON reads preserve binary bytes; human cat writes the original bytes", async (t) => {
  const { storage, invoke } = await fixture(t)
  const bytes = Buffer.from([0, 255, 1, 128])
  await storage.put(`people/${phone}/practice/raw.bin`, bytes)
  const read = result(await invoke(["files", "cat", "can://~/practice/raw.bin", "--json"]))
  assert.equal(read.encoding, "base64")
  assert.deepEqual(Buffer.from(read.content, read.encoding), bytes)
  const human = await invoke(["files", "cat", "can://~/practice/raw.bin"])
  assert.equal(human.code, 0)
  assert.deepEqual(human.bytes, bytes)
})

test("service errors and expired credentials remain machine-readable failures", async (t) => {
  const { invoke } = await fixture(t)
  const missing = await invoke(["files", "cat", "can://~/practice/missing.txt", "--json"])
  assert.equal(missing.code, 1)
  assert.equal(missing.stderr, "")
  const failed_read = JSON.parse(missing.stdout)
  assert.equal(failed_read.ok, false)
  assert.equal(failed_read.command, "files.cat")
  assert.equal(failed_read.error.code, "service_error")
  assert.equal(failed_read.error.status, 404)
  const expired = await invoke(["files", "cat", "can://~/practice/missing.txt", "--json"], { TOKEN: token({ exp: Math.floor(Date.now() / 1000) - 1 }) })
  assert.equal(expired.code, 1)
  assert.equal(JSON.parse(expired.stdout).error.status, 401)
})

test("CLI conflicts retain partial results and a failing exit status", async (t) => {
  const { root, storage, invoke } = await fixture(t)
  const folder = join(root, "conflict")
  await mkdir(folder)
  await writeFile(join(folder, "note.txt"), "base\n")
  result(await invoke(["files", "sync", folder, "can://~/conflict/", "--json"]))
  await writeFile(join(folder, "note.txt"), "ours\n")
  const put = storage.put
  let raced = false
  storage.put = async (key, bytes, options) => {
    if (key === `people/${phone}/conflict/note.txt` && !raced) {
      raced = true
      await put(key, "theirs\n")
    }
    return put(key, bytes, options)
  }
  const output = await invoke(["files", "sync", folder, "can://~/conflict/", "--json"])
  assert.equal(raced, true)
  assert.equal(output.code, 1)
  assert.equal(output.stderr, "")
  const failure = JSON.parse(output.stdout)
  assert.equal(failure.ok, false)
  assert.equal(failure.error.code, "sync_conflict")
  assert.deepEqual(failure.result.conflicts, ["note.txt"])
  assert.equal((await storage.get(`people/${phone}/conflict/note.txt`)).body.toString(), "theirs\n")
  assert.equal(await readFile(join(folder, "note.txt"), "utf8"), "ours\n")
})

test("invalid commands and non-personal paths fail without contacting the service", async (t) => {
  const { root, server, invoke } = await fixture(t)
  let requests = 0
  server.on("request", () => requests++)
  for (const args of [
    ["files", "sync", join(root, "local"), "can://people/+15555550999/", "--json"],
    ["files", "cat", "can://~/practice/", "--json"],
    ["files", "sync", "--json"],
    ["files", "remove", "can://~/practice/note.txt", "--json"],
    ["files", "sync", join(root, "local"), "can://~/practice/", "--deletes", "--json"],
  ]) {
    const output = await invoke(args)
    assert.equal(output.code, 1)
    assert.equal(JSON.parse(output.stdout).error.code, "usage")
  }
  assert.equal(requests, 0)
})

test("help needs no sign-in; a missing sign-in returns a structured error", async () => {
  let stdout = "", stderr = "", lookups = 0
  const options = {
    get_token: async () => { lookups++; return null },
    stdout: { write: (value) => { stdout += value } },
    stderr: { write: (value) => { stderr += value } },
  }
  assert.equal(await run(["--help", "--json"], options), 0)
  assert.equal(JSON.parse(stdout).command, "help")
  assert.equal(lookups, 0)
  stdout = ""
  assert.equal(await run(["files", "cat", "can://~/note.txt", "--json"], options), 1)
  assert.equal(JSON.parse(stdout).error.code, "not_signed_in")
  assert.equal(stderr, "")
})

test("sync conflicts preserve the partial report for callers", async () => {
  const report = { pushed: ["saved.txt"], conflicts: ["changed.txt"] }
  const files = file_capabilities({ store: { sync: async () => report } })
  await assert.rejects(files.sync({ local: "local", remote: "can://~/practice/" }), (error) => {
    assert.ok(error instanceof CapabilityError)
    assert.equal(error.code, "sync_conflict")
    assert.equal(error.result, report)
    return true
  })
})
