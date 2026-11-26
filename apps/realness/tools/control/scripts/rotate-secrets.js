#!/usr/bin/env node
/**
 * Rotate the secrets a provider leak exposed, in every place that holds them.
 *
 *   node tools/control/scripts/rotate-secrets.js [--dry]
 *
 * New HALO_PASS_SECRET and MODEL_PASS_SECRET for development and production,
 * the pasted OpenRouter key into both projects (the proxy reads it), the local
 * copies the Mac stack reads, then a new Cloud Run revision of proxy, sync, and
 * gate so each picks up `:latest`.
 */
import { spawnSync as spawn_sync } from 'node:child_process'
import { randomBytes as random_bytes } from 'node:crypto'
import { writeFileSync as write_file_sync } from 'node:fs'
import { createInterface as create_interface } from 'node:readline'
import { secret_path } from '#root/src/settings/secrets.js'

const dry = process.argv.includes('--dry')
const SECRET_BYTES = 32
const SHOWN_TAIL = 4
const out = text => process.stdout.write(`${text}\n`)
const err = text => process.stderr.write(`${text}\n`)

const PROJECTS = {
  development: { project: 'realness-development', region: 'us-central1' },
  production: { project: 'realness-online', region: 'us-west2' }
}

/** Cloud Run services and the secrets each mounts. */
const SERVICES = {
  'realness-proxy': ['MODEL_PASS_SECRET', 'OPENROUTER_API_KEY'],
  'realness-sync': ['HALO_PASS_SECRET'],
  'realness-gate': ['HALO_PASS_SECRET']
}

/**
 * @param {string[]} args
 * @param {string} [input]
 */
const gcloud = (args, input) => {
  if (dry)
    return (
      out(`  gcloud ${args.join(' ')}${input ? ' < value' : ''}`),
      { status: 0, stdout: '' }
    )
  const result = spawn_sync('gcloud', args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  if (result.status)
    throw new Error(
      `gcloud ${args.slice(0, 3).join(' ')}: ${result.stderr.trim().split('\n').at(-1)}`
    )
  return result
}

/** @param {string} prompt */
const ask_hidden = async prompt => {
  if (!process.stdin.isTTY) {
    let text = ''
    for await (const chunk of process.stdin) text += chunk
    return text.replace(/[\r\n]/g, '').trim()
  }
  return new Promise(done => {
    const rl = create_interface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    })
    Object.assign(rl, { _writeToOutput: () => {} })
    process.stdout.write(prompt)
    rl.question('', answer => {
      rl.close()
      process.stdout.write('\n')
      done(answer.replace(/[\r\n]/g, '').trim())
    })
  })
}

/**
 * @param {string} name
 * @param {string} value
 * @param {string} project
 */
const store = (name, value, project) => {
  const exists =
    dry ||
    spawn_sync('gcloud', ['secrets', 'describe', name, `--project=${project}`])
      .status === 0
  gcloud(
    exists
      ? [
          'secrets',
          'versions',
          'add',
          name,
          '--data-file=-',
          `--project=${project}`
        ]
      : [
          'secrets',
          'create',
          name,
          '--data-file=-',
          '--replication-policy=automatic',
          `--project=${project}`
        ],
    value
  )
  out(
    `  ${project} ${name}: new version, ending ...${value.slice(-SHOWN_TAIL)}`
  )
}

const account = spawn_sync(
  'gcloud',
  ['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'],
  {
    encoding: 'utf8'
  }
).stdout.trim()
if (!account && !dry) {
  err('gcloud has no active account. Run: gcloud auth login')
  process.exit(1)
}
out(`gcloud: ${account || 'none (dry run)'}`)

const openrouter = await ask_hidden(
  'Paste the NEW OpenRouter key (sk-or-v1-...), then Enter: '
)
if (!/^sk-or-v1-[A-Za-z0-9]{32,}$/.test(openrouter)) {
  err('That is not an OpenRouter key; nothing changed.')
  process.exit(1)
}

for (const [env, { project, region }] of Object.entries(PROJECTS)) {
  out(`\n${env} (${project})`)
  const halo = random_bytes(SECRET_BYTES).toString('hex')
  const model = random_bytes(SECRET_BYTES).toString('hex')
  store('HALO_PASS_SECRET', halo, project)
  store('MODEL_PASS_SECRET', model, project)
  store('OPENROUTER_API_KEY', openrouter, project)
  if (env === 'development') {
    const local = {
      'halo-pass-secret': halo,
      'model-pass-secret': model,
      'openrouter-key': openrouter
    }
    for (const [file, value] of Object.entries(local)) {
      if (!dry)
        write_file_sync(secret_path(file), `${value}\n`, { mode: 0o600 })
      out(`  local ${file}: written`)
    }
  }
  for (const [service, secrets] of Object.entries(SERVICES)) {
    const found =
      dry ||
      spawn_sync('gcloud', [
        'run',
        'services',
        'describe',
        service,
        `--region=${region}`,
        `--project=${project}`
      ]).status === 0
    if (!found) {
      out(`  ${service}: not deployed here, skipped`)
      continue
    }
    gcloud([
      'run',
      'services',
      'update',
      service,
      `--region=${region}`,
      `--project=${project}`,
      `--update-secrets=${secrets.map(name => `${name}=${name}:latest`).join(',')}`,
      `--update-env-vars=SECRETS_ROTATED_AT=${new Date().toISOString().replace(/[:.]/g, '-')}`,
      '--quiet'
    ])
    out(`  ${service}: new revision on the new secrets`)
  }
}

out(`
Left for you:
  1. Halos re-read the pass secrets on restart:
       npm run halo -- development halo restart <name>
       npm run halo -- production halo restart <name>
     and restart the local stack: npm run local.
  2. Everyone signs in again: old passes no longer verify.
  3. Delete the OLD OpenRouter key at https://openrouter.ai/keys.
  4. Anthropic: revoke sessions at claude.ai, then /login in pi and Claude Code.`)
