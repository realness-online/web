#!/usr/bin/env node
import {
  execFileSync as exec_file_sync,
  spawnSync as spawn_sync
} from 'node:child_process'
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { environment_settings } from '#root/src/settings/environments.js'
import {
  halo_files,
  halo_folders,
  service_folders
} from '#root/src/settings/layout.js'
import { run_entry } from '#root/scripts/lib/entry.js'

const SERVICES = ['proxy', 'gate', 'sync']
const FUNCTIONS = 'functions'
const CLOUD_RUN = ['realness-sync', 'realness-proxy', 'realness-gate']
const NAME_WIDTH = 16
const ENVIRONMENT = 'production'
const HALO_FLAG = '--halo='.length
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z]))?$/

const out = text => process.stdout.write(`${text}\n`)
const err = text => process.stderr.write(`${text}\n`)

const git = args => exec_file_sync('git', args, { encoding: 'utf8' }).trim()

const run = (program, args) => {
  const result = spawn_sync(program, args, { stdio: 'inherit' })
  if (result.status !== 0)
    throw new Error(`${program} ${args.join(' ')} failed with ${result.status}`)
}

/** gcloud needs a Python that still has ssl.PROTOCOL_TLSv1 for bucket calls. */
const gcloud_python = () => {
  if (process.env.CLOUDSDK_PYTHON) return
  const candidates = [
    '/opt/homebrew/bin/python3.11',
    '/usr/local/bin/python3.11'
  ]
  const found = candidates.find(candidate => exists_sync(candidate))
  if (found) process.env.CLOUDSDK_PYTHON = found
}

const read = (program, args) =>
  exec_file_sync(program, args, { encoding: 'utf8' })

/** The next letter on the release line: 3.0.0-i becomes 3.0.0-j. */
export const next_version = current => {
  const parts = VERSION.exec(current)
  if (!parts) throw new Error(`cannot read version "${current}"`)
  const [, major, minor, patch, letter] = parts
  if (!letter) return `${major}.${minor}.${patch}-a`
  if (letter === 'z') throw new Error(`${current} is the end of its line`)
  const following = String.fromCharCode(letter.charCodeAt(0) + 1)
  return `${major}.${minor}.${patch}-${following}`
}

/** True when a changed path sits inside one of the given folders or files. */
export const touches = (paths, inputs) =>
  paths.some(path =>
    inputs.some(input => path === input || path.startsWith(`${input}/`))
  )

/**
 * What a release deploys, from the folders each target already declares. The
 * frontend is every release's product surface, so it always deploys.
 */
export const choose = paths => [
  'frontend',
  ...SERVICES.filter(service => touches(paths, service_folders(service))),
  ...(touches(paths, [FUNCTIONS]) ? ['functions'] : []),
  ...(touches(paths, [...halo_folders(), ...halo_files]) ? ['halo'] : [])
]

const revisions = settings =>
  JSON.parse(
    read('gcloud', [
      'run',
      'services',
      'list',
      `--project=${settings.project}`,
      `--region=${settings.services.region}`,
      '--format=json'
    ])
  ).reduce((all, service) => {
    const { name } = service.metadata
    return {
      ...all,
      [name]: service.status?.latestReadyRevisionName ?? ''
    }
  }, {})

const deploy = (target, settings, halo) => {
  if (target === 'frontend')
    return run('node', [
      'tools/cli/bin/realness.js',
      'frontend',
      'deploy',
      '--env',
      ENVIRONMENT
    ])
  if (target === 'functions') return run('npm', ['run', 'deploy:functions'])
  if (target === 'halo')
    return run('npm', [
      'run',
      'realness',
      '--',
      ENVIRONMENT,
      'halo',
      'restart',
      halo,
      '--approved'
    ])
  return run('npm', ['run', `deploy:${target}`, '--', ENVIRONMENT])
}

const report = (before, after) =>
  CLOUD_RUN.map(name => {
    const from = before[name] ?? 'none'
    const to = after[name] ?? 'none'
    const state = from === to ? 'UNCHANGED' : 'changed'
    return `${name.padEnd(NAME_WIDTH)} ${from} -> ${to} ${state}`
  }).join('\n')

/** How long verify re-checks a deploy that has not landed yet. */
const SETTLE_SECONDS = '180'

/**
 * The frontend deploy builds the site once, so the release uploads that build.
 * Verify covers the site against the release and the services against their
 * staged bytes. `resume` skips the version step: the tag already exists.
 */
export const release_plan = (targets, { resume = false } = {}) => [
  ...(resume ? [] : ['version']),
  ...targets.map(target => `deploy:${target}`),
  'release',
  ...(targets.includes('frontend') ? ['verify'] : []),
  ...(targets.some(target => SERVICES.includes(target))
    ? ['verify:services']
    : [])
]

/** True when HEAD carries the tag for `version`: a release that stopped partway. */
const tagged = version =>
  git(['tag', '--points-at', 'HEAD']).split('\n').includes(`v${version}`)

/** The release already on GitHub is left alone when resuming. */
const released = version =>
  spawn_sync('gh', ['release', 'view', `v${version}`], { stdio: 'ignore' })
    .status === 0

export const main = () => {
  gcloud_python()
  const args = process.argv.slice(2)
  const halo = args.find(arg => arg.startsWith('--halo='))?.slice(HALO_FLAG)
  const dry_run = args.includes('--dry-run')
  const resume = args.includes('--resume')
  const dirty = git(['status', '--porcelain'])
  if (dirty && !dry_run) {
    err('uncommitted changes; a release must match its tag')
    for (const line of dirty.split('\n')) err(`  ${line}`)
    return 1
  }

  const { version: current } = JSON.parse(
    read_file_sync('package.json', 'utf8')
  )
  if (resume && !tagged(current)) {
    err(`--resume needs HEAD tagged v${current}`)
    return 1
  }
  const next = resume ? current : next_version(current)
  const previous = git([
    'describe',
    '--tags',
    '--abbrev=0',
    resume ? 'HEAD^' : 'HEAD'
  ])
  const changed = git([
    'diff',
    '--name-only',
    '--relative',
    `${previous}..HEAD`
  ]).split('\n')
  const targets = choose(changed)
  const settings = environment_settings(ENVIRONMENT)

  out(resume ? `resume     ${current}` : `release    ${current} -> ${next}`)
  out(`changes    ${changed.length} files since ${previous}`)
  out(`deploys    ${targets.join(', ')}`)
  if (dry_run) {
    out('\nnothing released: rerun without --dry-run')
    return 0
  }

  const before = revisions(settings)
  for (const step of release_plan(targets, { resume }))
    if (step === 'version') run('npm', ['version', next])
    else if (step === 'release') {
      if (!(resume && released(next))) run('npm', ['run', 'release:gh'])
    } else if (step === 'verify')
      run('npm', [
        'run',
        'verify',
        '--',
        '--release',
        '--settle',
        SETTLE_SECONDS
      ])
    else if (step === 'verify:services')
      run('npm', [
        'run',
        'verify',
        '--',
        '--services',
        targets.filter(target => SERVICES.includes(target)).join(','),
        '--settle',
        SETTLE_SECONDS
      ])
    else {
      const target = step.slice('deploy:'.length)
      out(`\n==> ${target}`)
      deploy(target, settings, halo ?? 'realness-1')
    }

  const after = revisions(settings)
  out(`\n${report(before, after)}`)
  const moved = SERVICES.filter(service => targets.includes(service))
  const stale = CLOUD_RUN.filter(
    name => (before[name] ?? '') === (after[name] ?? '')
  ).filter(name => moved.some(service => name.endsWith(service)))
  if (stale.length) {
    err(`\nno new revision: ${stale.join(', ')}`)
    return 1
  }
  out(`\nreleased ${next}`)
  return 0
}

await run_entry(import.meta.url, () => {
  process.exitCode = main()
})
