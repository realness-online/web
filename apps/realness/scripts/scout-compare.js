#!/usr/bin/env node
/**
 * Run one source of one scout on this Mac and in a box, then compare the leads.
 *
 *     node scripts/scout-compare.js realness-leads --source vuejobs
 *     node scripts/scout-compare.js realness-leads --source vuejobs \
 *       --mac-model openrouter/deepseek/deepseek-v4-flash \
 *       --box-model realness/standard
 *
 * Both sides start from the same plan, with no finds, runs, or leads, so the
 * two runs read the same brief. Each side writes into its own copy under
 * `artifacts/scout-compare/<stamp>/`, and nothing touches the vault.
 */
import { spawn } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { read_items } from '#root/lib/items.js'
import { read_leads } from '#root/src/scouts/leads.js'
import {
  all_confirmed,
  box_model_for,
  compare_finds,
  save_box_leads,
  compare_lines,
  confirms,
  run_line,
  side_root
} from '#root/src/scouts/compare.js'
import { local_settings } from '#root/src/settings/environments.js'
import { issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'
import { person } from '#root/src/harness/settings.js'
import { secret_path } from '#root/src/settings/secrets.js'
import { run_entry } from './lib/entry.js'

const here =
  process.env.REALNESS_HOME ??
  resolve(dirname(file_url_to_path(import.meta.url)), '../../..')
const vault_dir = resolve(here, 'vault')
const BOX_SCOUT_JS = '/usr/local/lib/realness/scripts/scout.js'

/** The value after a flag, or empty. */
const value_of = (args, flag) => {
  const at = args.indexOf(flag)
  return at === -1 ? '' : (args[at + 1] ?? '')
}

const RUNS_IN_A_ROW = 3

const DEFAULT_MAC_MODEL = 'openrouter/deepseek/deepseek-v4-flash'
const DEFAULT_BOX_MODEL = 'realness/standard'

/** A halo pass for the owner, so the comparison may use the box. */
const pass_of = owner => {
  const secret = read_file_sync(secret_path('halo-pass-secret'), 'utf8').trim()
  return issue_halo_pass({ phone: owner }, secret)
}

/** One call to the halo's API, with the pass in the header. */
const halo_call = (halo, owner, method, path, body) =>
  fetch(`${halo}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${pass_of(owner)}`,
      'content-type': 'application/json'
    },
    ...(body && { body: JSON.stringify(body) })
  })

/** The longest a box run may take, in seconds, as the halo counts them. */
const RUN_SECONDS = 900

const COLLECT_SECONDS = 120
const MS_PER_SECOND = 1000

/**
 * The shell that makes the box's side of the comparison: the same code as this
 * Mac, and a vault holding only the plan under test.
 * @param {{ root: string, plan: string }} options
 */
export const box_prep = ({ root, plan }) =>
  [
    'set -e',
    `rm -rf ${root}`,
    `mkdir -p ${root}/vault/Projects`,
    'for p in /realness/* /realness/.[!.]*; do',
    '  b=$(basename "$p")',
    '  case "$b" in vault|artifacts|apps|nvim.root) continue;; esac',
    `  ln -s "$p" "${root}/$b"`,
    'done',
    `ln -s /apps ${root}/apps`,
    `cp -r /realness/vault/Projects/${plan} ${root}/vault/Projects/`,
    `rm -rf ${root}/vault/Projects/${plan}/Finds`,
    `rm -rf ${root}/vault/Projects/${plan}/Runs`,
    `rm -rf ${root}/vault/Projects/${plan}/Leads`
  ].join('\n')

/**
 * The shell that runs the box's scout: the same `scout.js --run` this Mac runs,
 * on the model named for the task.
 * @param {{ root: string, plan: string, source: string, model: string, person: string }} options
 */
export const box_run = ({ root, plan, source, model, person }) =>
  [
    'set -e',
    `mkdir -p ${root}/tmp`,
    'cd /realness',
    `REALNESS_HOME=${root} TMPDIR=${root}/tmp REALNESS_PERSON=${person} \\`,
    `  /usr/local/bin/node ${BOX_SCOUT_JS} ${plan} --source ${source} --run --model ${model}`
  ].join('\n')

/** The shell that prints what the box's run wrote, between two markers. */
export const box_collect = ({ root, plan }) =>
  [
    'set -e',
    `cd ${root}/vault/Projects/${plan}/Runs`,
    'd=$(ls -d */ | tail -n 1)',
    'echo "<<<FOUND"',
    `cat "$d/finds.html"`,
    'echo ">>>FOUND"',
    'echo "<<<STEPS"',
    `cat "$d/steps.html"`,
    'echo ">>>STEPS"'
  ].join('\n')

/** The text between two markers, or empty. */
export const between = (text, start, end) =>
  text.split(start)[1]?.split(end)[0]?.trim() ?? ''

/** Read one streamed exec, printing its output as it lands. */
const exec_stream = async ({ halo, owner, id }, argv, timeout, name, say) => {
  const began = Date.now()
  const response = await halo_call(
    halo,
    owner,
    'POST',
    `/v1/actors/${id}/exec`,
    {
      argv,
      stream: true,
      timeout
    }
  )
  if (!response.ok)
    throw new Error(`box exec ${response.status}: ${await response.text()}`)
  let rest = ''
  let text = ''
  for await (const chunk of response.body) {
    const lines = (rest + Buffer.from(chunk).toString()).split('\n')
    rest = lines.pop()
    for (const line of lines) {
      if (!line) continue
      const event = JSON.parse(line)
      if (event.type !== 'output') continue
      const out = Buffer.from(event.data_b64, 'base64').toString()
      text += out
      say(out.replace(/^/gm, `${name} `))
    }
  }
  return { text, seconds: Math.round((Date.now() - began) / MS_PER_SECOND) }
}

/** Run this Mac's scout on the copy, and say how long it took. */
const mac_run = ({ root, plan, source, model, owner, say }) =>
  new Promise((done, fail) => {
    const began = Date.now()
    mkdir_sync(join(root, 'artifacts', 'tmp'), { recursive: true })
    const child = spawn(
      process.execPath,
      [
        resolve(here, 'apps/realness/scripts/scout.js'),
        plan,
        '--source',
        source,
        '--run',
        '--model',
        model
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          REALNESS_HOME: root,
          REALNESS_PERSON: owner,
          TMPDIR: join(root, 'artifacts', 'tmp')
        }
      }
    )
    let text = ''
    child.stdout.on('data', chunk => {
      text += chunk
      say(String(chunk).replace(/^/gm, 'mac '))
    })
    child.stderr.on('data', chunk => say(String(chunk).replace(/^/gm, 'mac ')))
    child.on('error', fail)
    child.on('close', code =>
      done({
        text,
        code,
        seconds: Math.round((Date.now() - began) / MS_PER_SECOND)
      })
    )
  })

/** The leads one run's page holds, and the items it wrote that a lead needs fixed. */
const leads_of = html => read_leads(html)

/** The failure a run's own output names, or empty when it names none. */
const failure_of = output =>
  output
    .split('\n')
    .find(line => line.includes('failed:'))
    ?.split('failed:')[1]
    ?.trim() ?? ''

/**
 * One side of the comparison as the table shows it: its leads, the items a lead
 * needs fixed, its reads, or why it wrote nothing.
 * @param {object} side
 * @param {string} [side.plan_dir] the Mac side's plan folder
 * @param {string} [side.html] the box side's finds page
 * @param {string} [side.steps] the box side's steps page
 * @param {string} side.model
 * @param {number} side.seconds
 * @param {string} [side.output] what the run said
 */
export const read_side = ({
  plan_dir,
  html,
  steps,
  model,
  seconds,
  output = ''
}) => {
  let page = html
  let page_steps = steps
  if (plan_dir)
    try {
      const run_dir = newest_run(plan_dir)
      page = read_file_sync(join(run_dir, 'finds.html'), 'utf8')
      page_steps = read_file_sync(join(run_dir, 'steps.html'), 'utf8')
    } catch {
      page = ''
    }
  const { leads, problems } = leads_of(page ?? '')
  const failed = leads.length
    ? ''
    : problems[0]?.problem ||
      failure_of(output) ||
      (page?.trim() ? '' : 'wrote no finds')
  return {
    model,
    leads: leads.length,
    problems: problems.length,
    seconds,
    reads: reads_of(page_steps ?? ''),
    found: leads,
    ...(failed ? { failed } : {})
  }
}

/** How many pages one run read: the steps whose command read through the web. */
const reads_of = html =>
  read_items(html, 'step').filter(step =>
    /realness-read/.test(String(step.did ?? ''))
  ).length

const main = async () => {
  const args = process.argv.slice(2)
  const scout = args[0]?.startsWith('--') ? '' : (args[0] ?? '')
  if (!scout)
    throw new Error(
      'usage: scout-compare.js <scout> --source <key> [--runs <n>] [--mac-model <m>] [--box-model <m>]'
    )
  const source = value_of(args, '--source')
  if (!source) throw new Error('--source names the one source to compare')
  const mac_model = value_of(args, '--mac-model') || DEFAULT_MAC_MODEL
  const box_model = box_model_for(
    value_of(args, '--box-model') || DEFAULT_BOX_MODEL
  )
  const halo =
    value_of(args, '--halo') || `http://127.0.0.1:${local_settings.api_port}`
  const owner = (
    value_of(args, '--person') ||
    process.env.REALNESS_PERSON ||
    person(here) ||
    ''
  ).replace(/^\//, '')
  const say = line =>
    process.stdout.write(line.endsWith('\n') ? line : `${line}\n`)

  const page = read_file_sync(join(vault_dir, 'Projects', scout, 'scout.html'))
  if (!page.includes('itemtype="/scout"'))
    throw new Error(`${scout} holds no scout.html`)

  const runs = Number(value_of(args, '--runs') || RUNS_IN_A_ROW)
  const results = []
  const once = async () => {
    const stamp = String(Date.now())
    const mac_root = resolve(here, 'artifacts', 'scout-compare', stamp, 'mac')
    const box_root = `/realness/artifacts/scout-compare/${stamp}/box`

    say(`mac  ${scout} ${source} on ${mac_model}`)
    side_root({ harness: here, root: mac_root, plan: scout })
    const mac = await mac_run({
      root: mac_root,
      plan: scout,
      source,
      model: mac_model,
      owner,
      say
    })
    const mac_side = read_side({
      plan_dir: join(mac_root, 'vault', 'Projects', scout),
      model: mac_model,
      seconds: mac.seconds,
      output: mac.text
    })
    say(
      mac_side.failed
        ? `mac  failed: ${mac_side.failed}`
        : `mac  ${mac_side.leads} leads, ${mac_side.problems} broken, in ${mac.seconds}s`
    )

    say(`box  ${scout} ${source} on ${box_model}`)
    const list = await (
      await halo_call(halo, owner, 'GET', '/v1/actors')
    ).json()
    const actor = list.actors?.[0]
    if (!actor) throw new Error('no box on this halo for that owner')
    const target = { halo, owner, id: actor.id }
    await exec_stream(
      target,
      ['/bin/sh', '-c', box_prep({ root: box_root, plan: scout })],
      RUN_SECONDS,
      'box',
      say
    )
    const box = await exec_stream(
      target,
      [
        '/bin/sh',
        '-c',
        box_run({
          root: box_root,
          plan: scout,
          source,
          model: box_model,
          person: owner
        })
      ],
      RUN_SECONDS,
      'box',
      say
    )
    const collected = await exec_stream(
      target,
      ['/bin/sh', '-c', box_collect({ root: box_root, plan: scout })],
      COLLECT_SECONDS,
      'box',
      () => {}
    )
    const box_side = read_side({
      html: between(collected.text, '<<<FOUND', '>>>FOUND'),
      steps: between(collected.text, '<<<STEPS', '>>>STEPS'),
      model: box_model,
      seconds: box.seconds,
      output: box.text
    })
    say(
      box_side.failed
        ? `box  failed: ${box_side.failed}`
        : `box  ${box_side.leads} leads, ${box_side.problems} broken, in ${box.seconds}s`
    )

    const diff = compare_finds(box_side.found, mac_side.found)
    const result = { box: box_side, mac: mac_side, diff }
    say('')
    for (const line of compare_lines(result)) say(line)
    say('')
    if (box_side.leads) {
      const saved = await save_box_leads({
        plan_dir: join(vault_dir, 'Projects', scout),
        label: scout,
        source,
        leads: box_side.found,
        person: `/${owner}`
      })
      say(
        `box  saved ${saved.fresh.length} new, ${saved.repeats.length} repeats`
      )
    }
    say(confirms(result) ? 'confirmed' : 'not confirmed')
    say(
      `both sides kept in ${resolve(here, 'artifacts', 'scout-compare', stamp)}`
    )
    return result
  }

  for (let index = 1; index <= runs; index += 1) {
    results.push(await once())
    say(run_line(index, runs, results.at(-1)))
  }
  if (runs > 1)
    say(`${results.filter(confirms).length} of ${runs} runs confirmed`)
  if (!all_confirmed(results)) process.exitCode = 1
}

/** The newest run folder a plan holds, by name. */
const newest_run = plan_dir => {
  const runs = join(plan_dir, 'Runs')
  const names = readdir_sync(runs, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
  if (!names.length) throw new Error(`no run landed in ${runs}`)
  return join(runs, names.at(-1))
}

await run_entry(import.meta.url, main)
