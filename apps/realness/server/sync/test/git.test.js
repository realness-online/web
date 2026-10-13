import assert from "node:assert/strict"
import { createVerify, generateKeyPairSync, randomUUID } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { disk } from "#root/src/can/disk.js"
import { client } from "#root/src/files/client.js"
import { issue_harness_pass, issue_recovery_pass } from "#root/src/sign-on/node/recovery-pass.js"
import { answer, read_description } from "#root/src/harness/git-credential.js"
import { out_path } from "#root/lib/output.js"
import { read_git_record, repo_name } from "../../../src/sync/git.js"
import { rights } from "../../../src/sync/rights.js"
import { sync_service } from "../../../src/sync/server.js"

const secret = "git-test-secret-at-least-thirty-two-bytes!!"
const phone = "+14155550126"
const other = "+14155550127"
const id = "a-617000000001"
const dir = out_path(`git-test-${randomUUID()}`)
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const app = { app_id: "424242", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }
let storage, server, url, asked

const github = async (address, options) => {
  const [head, body, signature] = options.headers.authorization.replace(/^Bearer /, "").split(".")
  const signed = createVerify("RSA-SHA256").update(`${head}.${body}`).verify(publicKey, signature, "base64url")
  asked.push({ address, signed, claims: JSON.parse(Buffer.from(body, "base64url")), request: JSON.parse(options.body) })
  return new Response(JSON.stringify({ token: "ghs_hour", expires_at: "2026-10-08T04:00:00Z" }), { status: 201 })
}

before(async () => {
  await mkdir(dir, { recursive: true })
  storage = disk(join(dir, "bucket"))
  await storage.put(`git/${phone}.html`, `<article itemscope itemtype="https://schema.org/SoftwareApplication">
  <meta itemprop="identifier" content="777">
  <a itemprop="codeRepository" href="https://github.com/Scott/Realness">realness</a>
</article>
<article itemscope itemtype="https://schema.org/SoftwareApplication">
  <meta itemprop="identifier" content="888">
  <a itemprop="codeRepository" href="https://github.com/Share-More-Stories/seeq-app">seeq-app</a>
</article>\n`)
  server = sync_service({ storage, rights: rights(storage), project: "none", certs: async () => ({}), host_pass_secret: secret, git_app: app, git_fetch: github, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
  await rm(dir, { recursive: true, force: true })
})

const vm = (who = phone, issue = issue_harness_pass) => client({ url, token: issue({ phone: who, id }, secret), phone: who })

test("records and repo names parse strictly", () => {
  const record = read_git_record('<meta itemprop="identifier" content="9"><a itemprop="codeRepository" href="https://github.com/a/b.git">b</a>')
  assert.deepEqual(record, new Map([["a/b", "9"]]))
  const orgs = read_git_record('<article><meta itemprop="identifier" content="1"><a itemprop="codeRepository" href="https://github.com/me/x">x</a></article><article><meta itemprop="identifier" content="2"><a itemprop="codeRepository" href="https://github.com/Org/Y">y</a></article>')
  assert.deepEqual(orgs, new Map([["me/x", "1"], ["org/y", "2"]]))
  assert.deepEqual(read_git_record('<a itemprop="codeRepository" href="https://github.com/a/b">b</a>'), new Map())
  assert.equal(repo_name("/Scott/Realness.git"), "Scott/Realness")
  for (const bad of ["../x", "a/b/c", "a", "a/..", ""]) assert.equal(repo_name(bad), null, bad)
})

test("a VM gets an hour-long, read-only token for one repo its person shared", async () => {
  asked = []
  assert.deepEqual(await vm().git_token("scott/realness.git"), { token: "ghs_hour", expires_at: "2026-10-08T04:00:00Z" })
  const [call] = asked
  assert.equal(call.address, "https://api.github.com/app/installations/777/access_tokens")
  assert.equal(call.signed, true)
  assert.equal(call.claims.iss, "424242")
  assert.ok(call.claims.exp - call.claims.iat <= 600)
  assert.deepEqual(call.request, { repositories: ["realness"], permissions: { contents: "read" } })
})

test("each org's repo uses that org's installation", async () => {
  asked = []
  await vm().git_token("Share-More-Stories/seeq-app")
  const [call] = asked
  assert.equal(call.address, "https://api.github.com/app/installations/888/access_tokens")
  assert.deepEqual(call.request.repositories, ["seeq-app"])
})

test("unshared repos, other people, and non-VM callers get nothing", async () => {
  asked = []
  await assert.rejects(vm().git_token("scott/secret-repo"), { status: 404 })
  await assert.rejects(vm(other).git_token("scott/realness"), { status: 404 })
  await assert.rejects(vm(phone, issue_recovery_pass).git_token("scott/realness"), { status: 401 })
  await assert.rejects(client({ url, token: null, phone }).git_token("scott/realness"), { status: 401 })
  await assert.rejects(vm().git_token("../../etc"), { status: 400 })
  assert.equal(asked.length, 0, "GitHub is never asked for a refused repo")
})

test("people cannot write their own git record", async () => {
  const token = issue_harness_pass({ phone, id }, secret)
  const response = await fetch(`${url}/git/${phone}.html`, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: "x" })
  assert.equal(response.status, 403)
})

test("the helper answers git's get for GitHub only, and stores nothing", async () => {
  const store = vm()
  const get = "protocol=https\nhost=github.com\npath=scott/realness.git\n\n"
  assert.equal(await answer("get", get, store), "username=x-access-token\npassword=ghs_hour\n")
  assert.equal(await answer("get", "protocol=https\nhost=gitlab.com\npath=a/b\n", store), "")
  assert.equal(await answer("store", get, store), "")
  await assert.rejects(answer("get", "protocol=https\nhost=github.com\n", store), /useHttpPath/)
  assert.deepEqual(read_description("a=1\nb=x=y\n\nc=3"), { a: "1", b: "x=y" })
})

test("real git fills its credential through the helper", async () => {
  const { execFile } = await import("node:child_process")
  const { writeFile } = await import("node:fs/promises")
  const helper = join(dir, "helper.js")
  const modules = new URL("../../../", import.meta.url).pathname
  await writeFile(helper, `
import { client } from "${modules}src/files/client.js"
import { answer } from "${modules}src/harness/git-credential.js"
let text = ""
for await (const chunk of process.stdin) text += chunk
const store = client({ url: process.env.SYNC, token: process.env.PASS, phone: process.env.PHONE })
process.stdout.write(await answer(process.argv[2], text, store))
`)
  const env = { ...process.env, SYNC: url, PASS: issue_harness_pass({ phone, id }, secret), PHONE: phone, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", HOME: dir }
  const filled = await new Promise((done, fail) => {
    const git = execFile("git", ["-c", `credential.https://github.com.helper=!node ${helper}`, "-c", "credential.https://github.com.useHttpPath=true", "credential", "fill"], { env }, (error, stdout, stderr) => (error ? fail(new Error(stderr || error.message)) : done(stdout)))
    git.stdin.end("url=https://github.com/scott/realness.git\n\n")
  })
  assert.match(filled, /^username=x-access-token$/m)
  assert.match(filled, /^password=ghs_hour$/m)
})
