import assert from 'node:assert/strict'
import { issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'

const API = process.env.API ?? 'http://127.0.0.1:8080'
const owner = process.env.OWNER ?? '+14156667777'
const secret = process.env.HALO_PASS_SECRET
assert.ok(secret, 'HALO_PASS_SECRET is not set')

const call = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${issue_halo_pass({ phone: owner }, secret)}`,
      ...(body && { 'content-type': 'application/json' })
    },
    body: body && JSON.stringify(body)
  })
  const text = await response.text()
  return {
    status: response.status,
    text,
    json: text.startsWith('{') ? JSON.parse(text) : undefined
  }
}

const made = await call('POST', '/v1/actors', {})
assert.equal(made.status, 201, made.text)
const { id } = made.json
try {
  const command = 'cd /realness && node bin/checks/check-skills.js --run'
  const result = await call('POST', `/v1/actors/${id}/exec`, {
    argv: [
      'runuser',
      '-u',
      'realness',
      '--',
      'env',
      'HOME=/realness',
      'PATH=/usr/local/bin:/usr/bin:/bin',
      'sh',
      '-c',
      command
    ],
    timeout: 300
  })
  assert.equal(result.status, 200, result.text)
  const out =
    Buffer.from(result.json.stdout_b64, 'base64').toString() +
    Buffer.from(result.json.stderr_b64, 'base64').toString()
  console.log(out.trim())
  assert.equal(
    result.json.exit_code,
    0,
    "a shipped skill's check failed in the actor"
  )
  console.log(`PASS: every shipped skill's check passes in actor ${id}`)
} finally {
  await call('DELETE', `/v1/actors/${id}`)
}
