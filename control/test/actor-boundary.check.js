#!/usr/bin/env node
// g2d: on fresh actors, prove the three boundaries at once.
//
//   1. Non-root   Pi itself runs as `brayness`, and a command under that user
//                 cannot write a system path or read /etc/shadow.
//   2. Egress     the open internet answers; a sibling actor, the host's own
//                 address, and cloud metadata do not.
//   3. Model pass nothing is on disk; the host door mints one per call; the
//                 proxy accepts it and answers.
//
// The exec channel is a documented stub that runs everything as root, so it
// cannot prove a boundary by itself. This check uses it two ways: to inspect
// who owns the `pi` process, and to start every probe under `brayness` with
// setpriv - the same user Pi runs as, so the probe shares Pi's reach.
//
// Needs a template built from the current host/guest and a seed built from that
// template (`webspace dev host up --fresh`).
//
//   npm run check:boundary

import assert from "node:assert/strict"
import { createHmac as create_hmac } from "node:crypto"
import { existsSync as exists_sync, readFileSync as read_file_sync } from "node:fs"
import { after, before, describe, test } from "node:test"

const API = process.env.API ?? "http://127.0.0.1:18080"
const PROXY = process.env.BRAYNESS_PROXY_URL ?? "https://brayness-proxy-yelzvhhngq-uc.a.run.app"
const owner = "+14156667777"
const secret_path = new URL("../../dist/host-pass-secret", import.meta.url)
const secret = process.env.HOST_PASS_SECRET ?? (exists_sync(secret_path) ? read_file_sync(secret_path, "utf8").trim() : null)

const made = new Set()
let actor, neighbour

/** A short-lived pass naming one owner. The host door checks the signature. */
const host_pass = (phone = owner) => {
  assert.ok(secret && Buffer.byteLength(secret) >= 32, "HOST_PASS_SECRET required for check:boundary")
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `${body}.${create_hmac("sha256", secret).update(body).digest("base64url")}`
}

const call = async (method, path, body) => {
  const init = { method, headers: { authorization: `Bearer ${host_pass()}` } }
  if (body !== undefined) {
    init.headers["content-type"] = "application/json"
    init.body = JSON.stringify(body)
  }
  const response = await fetch(`${API}${path}`, init)
  const text = await response.text()
  const type = response.headers.get("content-type") ?? ""
  return { status: response.status, text, json: type.includes("json") && text ? JSON.parse(text) : undefined }
}

const create = async () => {
  const result = await call("POST", "/v1/actors")
  assert.equal(result.status, 201, result.text)
  made.add(result.json.id)
  return result.json.id
}

const destroy = async (id) => {
  await call("DELETE", `/v1/actors/${id}`)
  made.delete(id)
}

/** Run argv in an actor. The channel execs directly, so argv is the whole story. */
const run = async (id, argv, timeout = 60) => {
  const result = await call("POST", `/v1/actors/${id}/exec`, { argv, timeout })
  assert.equal(result.status, 200, result.text)
  const stdout = Buffer.from(result.json.stdout_b64, "base64").toString()
  const stderr = Buffer.from(result.json.stderr_b64, "base64").toString()
  return { code: result.json.exit_code, out: stdout, err: stderr, all: stdout + stderr }
}

/** The same script, but as `brayness`: the user Pi runs as. */
const as_brayness = (script) => ["/usr/bin/setpriv", "--reuid=brayness", "--regid=brayness", "--clear-groups", "/bin/bash", "-c", script]

before(async () => {
  actor = await create()
  neighbour = await create()
})

after(async () => {
  for (const id of made) await destroy(id).catch(() => {})
})

describe("g2d: the actor's boundaries", () => {
  test("non-root: Pi is brayness, and brayness is walled off from system paths", async () => {
    const processes = await run(actor, ["/bin/bash", "-c", "ps -u brayness -o comm="])
    assert.match(processes.out, /^pi$/m, `no pi process owned by brayness:\n${processes.all}`)

    const probe = await run(actor, as_brayness([
      "echo UID=$(id -u)",
      "echo USER=$(id -un)",
      "touch /usr/local/bin/brayness-probe 2>/dev/null && echo WRITE_ALLOWED || echo WRITE_DENIED",
      "cat /etc/shadow > /dev/null 2>&1 && echo SHADOW_READABLE || echo SHADOW_DENIED",
    ].join("\n")))
    assert.match(probe.all, /UID=(?!0\b)\d+/, probe.all)
    assert.match(probe.all, /USER=brayness/, probe.all)
    assert.match(probe.all, /WRITE_DENIED/, probe.all)
    assert.match(probe.all, /SHADOW_DENIED/, probe.all)
  })

  test("egress: the internet answers, the neighbour, host, and metadata do not", async () => {
    const mine = await run(actor, as_brayness(
      `curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST ${PROXY} -d '{}'`))
    assert.notEqual(mine.out.trim(), "000", `the actor cannot reach the proxy:\n${mine.all}`)

    // A live listener in the sibling proves the 000 below is the firewall and
    // not a dead server: both sit in the same /16 and share a default route.
    const started = await run(neighbour, ["/bin/bash", "-c", [
      "setsid nohup python3 -m http.server 8000 --bind 0.0.0.0 > /var/tmp/http.log 2>&1 &",
      "for i in $(seq 1 20); do curl -s -o /dev/null --max-time 1 http://127.0.0.1:8000/ && { echo SERVING; exit 0; }; sleep 0.5; done",
      "echo NOT_SERVING; exit 1",
    ].join("\n")])
    assert.match(started.out, /SERVING/, `no listener in the sibling:\n${started.all}`)
    const address = await run(neighbour, ["/bin/bash", "-c", "ip -4 -o addr show eth0 | awk '{print $4}' | cut -d/ -f1"])
    const neighbour_ip = address.out.trim()

    const local = await run(actor, as_brayness([
      "GW=$(ip -4 route show default | awk '{for (i = 1; i <= NF; i++) if ($i == \"via\") print $(i + 1)}')",
      `echo NEIGHBOUR=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://${neighbour_ip}:8000/)`,
      "echo HOST=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://$GW:18080/)",
      "echo META=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://169.254.169.254/)",
    ].join("\n")))
    assert.match(local.all, /NEIGHBOUR=000/, local.all)
    assert.match(local.all, /HOST=000/, local.all)
    assert.match(local.all, /META=000/, local.all)
  })

  test("model pass: none on disk, the door mints one, the proxy takes it", async () => {
    const probe = await run(actor, as_brayness([
      "test -e /etc/brayness/agent-pass && echo PASS_PRESENT || echo PASS_ABSENT",
      "PASS=$(brayness-model-pass) || echo MINT_FAILED",
      "echo PARTS=$(printf '%s' \"$PASS\" | awk -F. '{print NF}')",
      `echo CALL=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 -X POST ${PROXY} -H "authorization: Bearer $PASS" -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"say hi in one word"}],"stream":true}')`,
    ].join("\n")), 120)
    assert.match(probe.all, /PASS_ABSENT/, probe.all)
    assert.doesNotMatch(probe.all, /MINT_FAILED/, probe.all)
    assert.match(probe.all, /PARTS=2/, probe.all)
    assert.match(probe.all, /CALL=200/, probe.all)
  })
})
