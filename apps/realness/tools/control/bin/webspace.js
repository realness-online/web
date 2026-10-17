#!/usr/bin/env node
/**
 * realness - run halos, and the actors in them.
 *
 * An environment says *where halos live*, not *which command you may run*:
 *
 *   local        a Linux VM on this Mac, made by Lima
 *   development  a VM in realness-development, made by gcloud
 *
 * Both implement the same verbs, so every command works in either and only the
 * meaning of "a halo" changes.
 *
 *   realness local setup                      once per Mac: the Lima VM and artifacts
 *   realness local build                      stage the harness, build the template
 *
 *   realness <env> halo up [<name>] [--smoke]     make a halo, put the code on it, serve
 *   realness <env> halo restart <name>            push the code and re-serve
 *   realness <env> halo down <name> [--delete] [--no-drain]
 *   realness <env> halo drain <name> [--delete]   export every actor to the bucket
 *   realness <env> halo list
 *   realness <env> halo status [<name>] [--json]
 *   realness <env> probe [<type>:<zone> ...]      which zones can make a halo now
 *
 * The environment is the first word and is required: no default and no
 * environment variable, so a typo fails instead of running somewhere unintended.
 */
import {
  cloud_text as reconcile_cloud_text,
  reconcile_cloud,
  reconcile_models,
  reconcile_text
} from '../../../src/control/reconcile.js'
import { environment, isLocal as is_local } from '../webspace.config.js'
import { gcloud } from '../../../src/control/cloud.js'
import { limaTarget as lima_target } from '../../../src/control/lima.js'
import { readFile as read_file } from 'node:fs/promises'
import { attempt, note, step } from '../../../src/control/exec.js'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import * as dev from '../../../src/control/dev.js'
import {
  up as gcp_up,
  down as gcp_down,
  restart as gcp_restart,
  revoke as gcp_revoke
} from '../../../src/control/halo-gcp.js'
import {
  up as lima_up,
  down as lima_down,
  restart as lima_restart
} from '../../../src/control/halo-lima.js'
import * as drain from '../../../src/control/drain.js'
import { probe } from '../../../src/control/probe.js'
import { halo_status, format_status } from '../../../src/control/status.js'
import {
  set_json_output,
  result,
  mask_phones
} from '../../../src/control/output.js'
import {
  admin_login,
  admin_identity,
  admin_logout
} from '../../../src/control/auth.js'
import * as reads from '../../../src/control/reads.js'
import { OPERATOR_START_MS } from '../../../src/sync/halo-lifecycle.js'
import * as cloud from '../../../src/control/cloud-reads.js'
import { gather, overview_text } from '../../../src/control/overview.js'
import { attention } from '../../../src/control/attention.js'
import {
  manage_admins,
  ensure_admins,
  admins_text
} from '../../../src/control/admins.js'
import { local_person } from '#root/src/harness/settings.js'
import { project_root } from '#root/src/settings/layout.js'
import { disk } from '../../../src/can/disk.js'
import { create_gcs, gcloud_token } from '../../../src/can/gcs.js'
import { billing_store, grant_plan } from '../../../src/proxy/billing.js'
import { deployment_settings } from '#root/src/settings/environments.js'
import { out_path } from '#root/src/settings/output.js'

let json_output = false

const USAGE = `usage: realness <local|development|production> <command> [options]

  setup                        local only: the Lima VM, artifacts, a boot check
  build                        local only: stage the harness, build the template

  halo up [<name>] [--smoke] [--expire=2h]  make a halo, put the code on it, serve (~3 min in GCP)
  halo restart <name>          push the code and re-serve
  halo down <name> [--delete]  park it, or drain and delete
  halo recover <name> [--yes]  recreate a failed halo's actors elsewhere (hs-f3)
  halo memory <actor>          what one actor costs the halo, by stage (hs-mem)
  halo hot                     which halos are over their limits (hs-hot)
  halo scale --report=<file>   one halo or a swarm, from measured capacity (hs-d1)
  halo move <phone> <halo>     move one actor to another halo (hs-n3)
  halo retire <name> [--delete] stop a halo whose actors have moved (hs-n4)
  halo lockdown [--apply]      ssh through IAP only; halo API from the gate subnet (pr3)
  halo revoke <name>           fence a failed halo: sync refuses its writes (hs-f2)
  halo drain <name> [--delete] export every actor to the bucket
  halo migrate                 copy legacy records and keys to halo paths
  halo list                    the halos this environment has
  halo status [<name>] [--json] read last-seen halo records through sync


  admin login|logout|whoami    browser sign-in; sync verifies admin access
  admins list                  who sync treats as a global admin (admins.html)
  admins init                  first admin from person.local.html, only if none exist
  admins add <phone> [name] [--yes]   dry-run unless --yes; bucket credentials
  admins remove <phone> [--yes]       refuses to remove the last admin
  actor list | actor show <id> actors from the halos' last reports
  actor idle|stop <id>         ask its halo; idle keeps memory, stop keeps disk
  loop list | loop show <id>   loop records
  loop stop <id>               ask the halo to stop the loop
  person <phone>               one person's actors, loops, and usage
  usage <phone> [--day=DATE]   one UTC day of the ledger; default today
  limit <phone>                limits, use, and what is left: today and month
  plan grant <phone> --credit=<dollars> --days=<n>   house-model credit, starting today
  status                       everything at once, attention last; exits 2 on attention
  service list                 Cloud Run services: ready, revision, deployed
  logs <service> [--since=1h] [--errors] [--limit=50]
  cost [--days=7]              billed cost from the billing export
  reconcile                    ledger vs OpenRouter; GCP bill vs expected services and spikes
  --json                      one JSON result; progress goes to stderr

  probe [<type>:<zone> ...]    development only: which zones can make a halo right now

  local: halo up                       lima start, guest-setup, dev-stack
  development: halo up realness-2 --smoke    disk, instance, volume, bootstrap, smoke, serve
`

/** Flags come after the subcommand; only a few are booleans. */
const parseFlags = args => {
  const flags = {}
  const rest = []
  for (const arg of args)
    if (arg.startsWith('--')) {
      const [key, ...value] = arg.slice(2).split('=')
      flags[key] = value.length ? value.join('=') : true
    } else rest.push(arg)

  return { flags, rest }
}

/** A halo name is required for everything but `up`. */
/** hs-mem: the stages an actor is measured in. */
const MEMORY_STAGES = [
  { name: 'as created', run: '' },
  { name: 'after a page fetch', run: 'true' }
]

/**
 * hs-mem: one reading of an actor. The halo side is the Firecracker process
 * Pss, which is what the halo cannot give to another actor; the guest side is
 * its own MemAvailable, read through the actor API.
 */
const sample_actor = async (cloud, config, halo, actor, api) => {
  const pid = (
    await cloud.call([
      ...cloud.sshArgs(halo, `pgrep -f 'firecracker.*${actor}' | head -1`),
      '--quiet'
    ])
  ).trim()
  if (!/^\d+$/.test(pid)) throw new Error(`no firecracker process for ${actor}`)
  const rolled = await cloud.call([
    ...cloud.sshArgs(halo, `cat /proc/${pid}/smaps_rollup`),
    '--quiet'
  ])
  const pss = /^Pss:\s+(\d+)/m.exec(rolled)
  if (!pss) throw new Error(`no Pss for ${actor}`)
  const inside = await api.call(`/v1/actors/${actor}/exec`, {
    method: 'POST',
    body: {
      argv: [
        'sh',
        '-c',
        "awk '/MemTotal|MemAvailable/{print $2}' /proc/meminfo; ps -eo rss,comm --sort=-rss | sed -n 2,4p"
      ],
      timeout: 60
    }
  })
  const text = Buffer.from(
    JSON.parse(inside).stdout_b64 ?? '',
    'base64'
  ).toString()
  const [total, available, ...top] = text.trim().split('\n')
  return {
    halo_mib: Math.round(Number(pss[1]) / 1024),
    guest_used_mib: Math.round((Number(total) - Number(available)) / 1024),
    top: top.map(line =>
      line
        .trim()
        .replace(/^(\d+)/, (_, kb) => `${Math.round(Number(kb) / 1024)}M`)
    )
  }
}

/** A field read as a number, or null when it is missing. */
const fraction = value =>
  Number.isFinite(Number(value)) ? Number(value) : null

/** The record reports bytes; the share in use is what a limit compares. */
const used_fraction = halo => {
  const total = Number(halo.mem_total)
  const free = Number(halo.mem_free)
  if (!total || !Number.isFinite(free)) return null
  return 1 - free / total
}

/** hs-hot: when a halo counts as crowded. */
const HOT_LIMITS = { cpu_fraction: 0.9, mem_used_fraction: 0.9, actors: 30 }

/** The placement records live in sync's bucket, in the list/read/remove shape. */
const placement_store = envName => {
  const gcs = create_gcs({
    bucket: deployment_settings(envName, process.env).bucket,
    token: gcloud_token()
  })
  return {
    get: key => gcs.get(key),
    delete: key => gcs.delete(key),
    read: key => gcs.get(key),
    write: (key, body) => gcs.put(key, body),
    list: async () =>
      (await gcs.list('placements')).files.map(file => `placements/${file}`)
  }
}

/** Where the person is placed, or an error naming what is missing. */
const placement_of = async (phone, gcs) => {
  const { placement_key, read_placement } =
    await import('../../../src/gate/placement.js')
  const held = await gcs.get(placement_key(phone))
  const placement = held ? read_placement(held.body.toString('utf8')) : null
  if (!placement) throw new Error(`no placement for ${phone}`)
  return placement.halo
}

/** The one live actor this person owns, from what the fleet last reported. */
const running_actor = async (envName, phone) => {
  const sync = await reads.reader(envName)
  const rows = await reads.actors(sync)
  const found = rows.find(
    actor => actor.owner === phone && actor.state !== 'incomplete'
  )
  if (!found) throw new Error(`no running actor for ${phone}`)
  return found
}

/**
 * hs-n3: bring the export down from the source halo and put it in the bucket,
 * the way drain ships one. The halo holds no storage credentials, so the copy
 * passes through here.
 */
const ship_bundle = async (name, config, actor, object) => {
  const scratch = join(out_path('moves'), actor)
  await mkdir(scratch, { recursive: true })
  const archive = join(scratch, 'bundle.tar.gz')
  const pulled = await attempt('gcloud', [
    'compute',
    'scp',
    `${name}:${config.haloExports ?? '/opt/fc/actors/mnt/exports'}/${actor}/artifacts.tar.gz`,
    archive,
    `--zone=${config.zone}`,
    '--quiet'
  ])
  if (!pulled.ok)
    throw new Error(`could not fetch the export: ${pulled.err.trim()}`)
  const copied = await attempt('gcloud', [
    'storage',
    'cp',
    '--quiet',
    archive,
    object
  ])
  if (!copied.ok) throw new Error(`upload failed: ${copied.err.trim()}`)
  return { shipped: true, bytes: (await stat(archive)).size }
}

/**
 * hs-n5: the actors every halo last reported through sync, for the drain
 * confirmation. A halo that has not reported is simply absent.
 */
const fleet_reader = envName => async () => {
  const sync = await reads.reader(envName)
  const rows = await reads.actors(sync)
  const by_halo = new Map()
  for (const actor of rows) {
    if (!by_halo.has(actor.halo)) by_halo.set(actor.halo, [])
    by_halo.get(actor.halo).push(actor)
  }
  return [...by_halo].map(([name, actors]) => ({ name, actors }))
}

const requireName = (rest, usage) => {
  const name = rest[0]
  if (!name) throw new Error(usage)
  return name
}

const main = async argv => {
  json_output = argv.includes('--json')
  set_json_output(json_output)
  const [envName, ...tail] = argv.filter(arg => arg !== '--json')
  if (
    !envName ||
    envName === '--help' ||
    envName === '-h' ||
    tail.includes('--help') ||
    tail.includes('-h')
  ) {
    result({ usage: USAGE }, USAGE.trimEnd())
    return 0
  }

  const { flags, rest } = parseFlags(tail)
  const named = environment(envName)
  /** A zone with capacity today; `probe` says which. */
  const config =
    typeof flags.zone === 'string' ? { ...named, zone: flags.zone } : named
  const local = is_local(config)
  const [command, ...args] = rest

  const hosts = local
    ? {
        kind: 'lima',
        target: lima_target(config),
        mod: { up: lima_up, down: lima_down, restart: lima_restart }
      }
    : {
        kind: 'gcp',
        target: gcloud(config),
        mod: {
          up: gcp_up,
          down: gcp_down,
          restart: gcp_restart,
          revoke: gcp_revoke
        }
      }

  switch (command) {
    case 'setup':
      if (!local)
        throw new Error(
          'setup makes the local Lima VM; there is nothing to set up in prod'
        )
      return finish(await dev.setup(hosts.target))

    case 'build':
      if (!local)
        throw new Error(
          'build makes the local template; cloud halos boot the fleet image'
        )
      return finish(await dev.build(hosts.target))

    case 'halo':
      return finish(await halo_command(hosts, config, args, flags, envName))

    case 'admin': {
      if (args.length !== 1)
        throw new Error('usage: realness <env> admin login|logout|whoami')
      if (args[0] === 'login') return finish(await admin_login(envName))
      if (args[0] === 'logout') return finish(await admin_logout(envName))
      if (args[0] === 'whoami') return finish(await admin_identity(envName))
      throw new Error('usage: realness <env> admin login|logout|whoami')
    }

    case 'admins': {
      const [verb = 'list', phone, ...name] = args
      const usage =
        'usage: realness <env> admins list | init | add <phone> [name] | remove <phone> [--yes]'
      const bare = verb === 'list' || verb === 'init'
      if (
        !['list', 'init', 'add', 'remove'].includes(verb) ||
        (bare ? args.length > 1 : !phone)
      )
        throw new Error(usage)
      const storage = local
        ? disk(
            typeof flags.dir === 'string' ? flags.dir : out_path('site-sync')
          )
        : create_gcs({
            bucket: deployment_settings(envName, process.env).bucket,
            token: gcloud_token()
          })
      const harness =
        typeof flags.harness === 'string'
          ? flags.harness
          : join(project_root, '../..')
      const done =
        verb === 'init'
          ? await ensure_admins(storage, [local_person(harness)], {
              create_only: true
            })
          : await manage_admins(storage, {
              verb,
              phone,
              name: name.join(' '),
              yes: flags.yes === true
            })
      return finish({ records: done, text: admins_text(done, { verb }) })
    }

    case 'actor':
    case 'loop': {
      const [verb, id] = args
      const writes = command === 'actor' ? ['idle', 'stop'] : ['stop']
      const usage = `usage: realness <env> ${command} list | ${command} show|${writes.join('|')} <id>`
      if (
        args.length > 2 ||
        !(verb === 'list'
          ? !id
          : id && (verb === 'show' || writes.includes(verb)))
      )
        throw new Error(usage)
      const sync = await reads.reader(envName)
      if (writes.includes(verb)) {
        const done =
          command === 'actor'
            ? await reads.request_actor(sync, id, verb)
            : await reads.request_loop_stop(sync, id)
        return finish(done)
      }
      const rows =
        command === 'actor'
          ? await reads.actors(sync, id)
          : await reads.loops(sync, id)
      return finish({ records: rows, text: reads.text[`${command}s`](rows) })
    }

    case 'person': {
      const found = await reads.person(await reads.reader(envName), args[0], {
        day: flags.day
      })
      return finish({ records: found, text: reads.text.person(found) })
    }

    case 'limit': {
      const found = await reads.limit(await reads.reader(envName), args[0])
      return finish({ records: found, text: reads.text.limit(found) })
    }

    case 'plan': {
      const [verb, phone] = args
      if (verb !== 'grant' || args.length !== 2)
        throw new Error(
          'usage: realness <env> plan grant <phone> --credit=<dollars> --days=<n>'
        )
      const billing = billing_store(
        create_gcs({
          bucket: deployment_settings(envName, process.env).bucket,
          token: gcloud_token()
        })
      )
      const plan = await grant_plan(billing, phone, {
        credit: Number(flags.credit),
        days: Number(flags.days)
      })
      return finish({
        records: plan,
        text: `${plan.phone}: $${plan.credit.toFixed(2)} house credit until ${plan.end.slice(0, 10)}`
      })
    }

    case 'usage': {
      const found = await reads.usage(
        await reads.reader(envName),
        args[0],
        flags.day
      )
      return finish({ records: found, text: reads.text.usage(found) })
    }

    case 'status': {
      if (args.length) throw new Error('usage: realness <env> status [--json]')
      const now = Date.now()
      const sync = await reads.reader(envName)
      const view = await gather({ sync, config, now })
      const lines = attention(view, config.attention, now)
      result({ ...view, attention: lines }, overview_text(view, lines))
      return lines.length ? 2 : 0
    }

    case 'service': {
      if (args.length !== 1 || args[0] !== 'list')
        throw new Error('usage: realness <env> service list')
      const rows = await cloud.services(config.cloud)
      return finish({ records: rows, text: cloud.cloud_text.services(rows) })
    }

    case 'logs': {
      if (args.length !== 1)
        throw new Error(
          'usage: realness <env> logs <service> [--since=1h] [--errors] [--limit=50]'
        )
      const rows = await cloud.logs(config.cloud, args[0], {
        since: flags.since ?? '1h',
        errors: flags.errors === true,
        limit: flags.limit ?? 50
      })
      return finish({ records: rows, text: cloud.cloud_text.logs(rows) })
    }

    case 'cost': {
      const projects = [
        ...new Set([config.cloud.project, config.project].filter(Boolean))
      ]
      const found = await cloud.cost(config.cloud, projects, {
        days: flags.days ?? 7
      })
      return finish({ records: found, text: cloud.cloud_text.cost(found) })
    }

    case 'reconcile': {
      if (args.length) throw new Error('usage: realness <env> reconcile')
      const [models, gcp] = await Promise.allSettled([
        reconcile_models(await reads.reader(envName), config),
        reconcile_cloud(config)
      ])
      const settled = result =>
        result.status === 'fulfilled'
          ? result.value
          : { error: result.reason?.message ?? String(result.reason) }
      const found = { models: settled(models), gcp: settled(gcp) }
      const part = (r, text) =>
        r.error ? `  not checked: ${r.error}` : text(r)
      result(
        found,
        [
          part(found.models, reconcile_text),
          part(found.gcp, reconcile_cloud_text)
        ].join('\n')
      )
      return found.models.gaps?.length || found.gcp.gaps?.length
        ? 2
        : models.status === 'rejected' || gcp.status === 'rejected'
          ? 1
          : 0
    }

    case 'probe':
      if (local)
        throw new Error(
          'probe asks GCP which zones have capacity; dev has one local halo'
        )
      return finish(await probe(config, args))

    default:
      throw new Error(`unknown command "${command ?? ''}"\n\n${USAGE}`)
  }
}

/** Starting before the work, running after; a failed start stays starting until its deadline. */
const with_intent = async (envName, name, work) => {
  if (!name) return work()
  const sync = await reads.reader(envName)
  await reads.record_intent(sync, name, 'starting', {
    deadline_ms: OPERATOR_START_MS
  })
  const done = await work()
  await reads.record_intent(sync, name, 'running')
  return done
}

/** Halo verbs that create, change, or remove cloud resources. */
const CHANGES = [
  'up',
  'restart',
  'down',
  'drain',
  'revoke',
  'lockdown',
  'retire',
  'move',
  'recover',
  'migrate'
]

const halo_command = async (hosts, config, args, flags, envName) => {
  const [action, ...rest] = args
  const changes =
    CHANGES.includes(action) && !(action === 'lockdown' && !flags.apply)
  if (config.approval && changes && !flags.approved)
    throw new Error(
      `${envName} halo ${action} changes production; rerun with --approved`
    )
  const { target, mod } = hosts

  switch (action) {
    case 'up':
      return with_intent(envName, rest[0], () =>
        mod.up(target, config, rest[0], {
          smoke: Boolean(flags.smoke),
          fresh: Boolean(flags.fresh),
          ...(typeof flags.expire === 'string' && { expire: flags.expire }),
          ...(typeof flags['image-family'] === 'string' && {
            imageFamily: flags['image-family']
          }),
          ...(typeof flags['image-project'] === 'string' && {
            imageProject: flags['image-project']
          })
        })
      )

    case 'memory': {
      const actor = requireName(
        rest,
        'usage: realness <env> halo memory <actor> [halo]'
      )
      const host_name = rest[1] ?? config.hostName ?? 'realness-1'
      const { measure } = await import('../../../src/control/memory.js')
      const { remoteApi } = await import('../../../src/control/api.js')
      if (is_local(config)) throw new Error('memory measures a cloud halo')
      const api = remoteApi(host_name, { zone: config.zone })
      return finish(
        await measure({
          actor,
          stages: MEMORY_STAGES,
          run: argv =>
            api.call(`/v1/actors/${actor}/exec`, {
              method: 'POST',
              body: { argv, timeout: 120 }
            }),
          /** The halo's cost is the Firecracker process; the guest's own use comes from its MemAvailable, so nothing new is reported at rest. */
          sample: async () =>
            await sample_actor(target, config, host_name, actor, api)
        })
      )
    }

    case 'scale': {
      const { scale_choice, scale_text } =
        await import('../../../src/control/scale.js')
      const report = typeof flags.report === 'string' ? flags.report : null
      if (!report)
        throw new Error(
          'usage: realness <env> halo scale --report=<capacity report json> [--demand=N]'
        )
      const measured = JSON.parse(await read_file(report, 'utf8'))
      const choice = scale_choice({
        actors_per_halo: Number(
          measured.actors_per_halo ?? measured.actors_per_host ?? 0
        ),
        hourly_cost: Number(
          flags['hourly-cost'] ??
            measured.hourly_cost ??
            config.hourly_cost ??
            0
        ),
        ...(flags.demand && { demand: Number(flags.demand) })
      })
      return finish({ ...choice, text: scale_text(choice) })
    }

    case 'hot': {
      const { hot_halos, hot_text, relieve } =
        await import('../../../src/control/hot.js')
      const sync = await reads.reader(envName)
      const fleet = await reads.hosts(sync)
      const rows = fleet.map(row => ({
        name: row.halo.name,
        cpu_fraction: fraction(row.halo.cpu_fraction),
        /** The record carries bytes, not a fraction: mem_free of mem_total. */
        mem_used_fraction: used_fraction(row.halo),
        actors: row.actors.length
      }))
      const hot = hot_halos(rows, HOT_LIMITS)
      if (!flags.owner)
        return finish({
          halos: hot,
          text: hot.length ? hot_text(hot) : 'no halo is over its limits'
        })
      const crowded = fleet.find(row => row.halo.name === hot[0]?.halo)
      if (!crowded) throw new Error('no crowded halo to relieve')
      const plan = relieve(
        rows,
        HOT_LIMITS,
        { halo: crowded.halo.name, actors: crowded.actors },
        String(flags.owner)
      )
      return finish({
        ...plan,
        text: `${hot_text([plan])}\n\nrun: realness ${envName} halo move ${plan.owner} ${plan.to}`
      })
    }

    case 'recover': {
      const name = requireName(
        rest,
        'usage: realness <env> halo recover <name> [--yes]'
      )
      if (!flags.yes)
        throw new Error(
          `recover tears down ${name}'s authority and recreates its actors;` +
            ' rerun with --yes'
        )
      const { remoteApi } = await import('../../../src/control/api.js')
      const { recover } = await import('../../../src/control/recover.js')
      const { revoke } = await import('../../../src/control/halo-gcp.js')
      const { reassign } = await import('../../../src/gate/placement.js')
      const sync = await reads.reader(envName)
      const fleet = await reads.hosts(sync)
      const failed = fleet.find(row => row.halo.name === name)
      if (!failed) throw new Error(`no halo record for ${name}`)
      const alive = fleet
        .filter(row => row.halo.name !== name)
        .map(row => row.halo.name)
      const survivors = alive.map(halo => ({
        name: halo,
        actors: fleet.find(row => row.halo.name === halo)?.actors?.length ?? 0
      }))
      const gcs = placement_store(envName)
      const by_halo = new Map(survivors.map(halo => [halo.name, halo.actors]))
      return finish(
        await recover(name, {
          reason: `last reported ${failed.age_s}s ago`,
          actors: failed.actors,
          halos: alive,
          api: halo => remoteApi(halo, { zone: config.zone }),
          revoke: halo => revoke(config, halo),
          bundle: async id => {
            const object = `gs://${config.bucket}/actors/${id}/bundle.tar.gz`
            const found = await attempt('gcloud', [
              'storage',
              'objects',
              'describe',
              object,
              '--format=value(name)'
            ])
            return found.ok && found.out.trim() ? { bundle: object } : null
          },
          /** Drain removed the export folder from the halo it came from, so the bundle is put back before restore reads it. */
          restore: async (report_halo, id, owner, bundle) => {
            const { remoteApi: api_for } =
              await import('../../../src/control/api.js')
            const { place_bundle } =
              await import('../../../src/control/bundle.js')
            await place_bundle(target, config, report_halo, id, {
              object: bundle
            })
            return JSON.parse(
              await api_for(report_halo, { zone: config.zone }).call(
                '/v1/actors',
                {
                  method: 'POST',
                  body: { owner, restore_from: id }
                }
              )
            )
          },
          place: (who, halo) =>
            reassign(who, halo, { read: gcs.read, write: gcs.write }),
          load: async halo => by_halo.get(halo) ?? 0
        })
      )
    }

    case 'move': {
      const [phone, target_host] = rest
      if (!phone || !target_host)
        throw new Error('usage: realness <env> halo move <phone> <halo>')
      const { remoteApi } = await import('../../../src/control/api.js')
      const { move } = await import('../../../src/control/move.js')
      const { reassign } = await import('../../../src/gate/placement.js')
      const gcs = placement_store(envName)
      const where = await placement_of(phone, gcs)
      const actor = await running_actor(envName, phone)
      return finish(
        await move(actor.id, phone, {
          from: remoteApi(where, { zone: config.zone }),
          to: remoteApi(target_host, { zone: config.zone }),
          bundle: async id => {
            const object = `gs://${config.bucket}/actors/${id}/bundle.tar.gz`
            return {
              object,
              ...(await ship_bundle(where, config, id, object))
            }
          },
          place: (who, halo) =>
            reassign(who, halo, { read: gcs.read, write: gcs.write }),
          halo: target_host,
          release: true
        })
      )
    }

    case 'retire': {
      const name = requireName(
        rest,
        'usage: realness <env> halo retire <name> [--delete]'
      )
      const { remoteApi } = await import('../../../src/control/api.js')
      const { retire } = await import('../../../src/control/retire.js')
      const { release_placements } =
        await import('../../../src/gate/placement.js')
      const store = placement_store(envName)
      return finish(
        await retire(
          remoteApi(name, { zone: config.zone }),
          {
            release: halo =>
              release_placements(halo, {
                list: () => store.list(),
                read: key => store.get(key),
                remove: key => store.delete(key)
              })
          },
          {
            stop: () => target.call(['instances', 'stop', name, '--quiet']),
            drop: () => mod.down(target, config, name, { mode: 'delete' })
          },
          name,
          { delete: Boolean(flags.delete) }
        )
      )
    }

    case 'lockdown': {
      if (is_local(config)) throw new Error('lockdown is for cloud projects')
      const { attempt } = await import('../../../src/control/exec.js')
      const { lockdown } = await import('../../../src/control/lockdown.js')
      return lockdown(config, {
        apply: Boolean(flags.apply),
        run: argv => attempt('gcloud', argv)
      })
    }

    case 'revoke': {
      const name = requireName(rest, `usage: realness <env> halo revoke <name>`)
      if (is_local(config)) throw new Error('revoke is for cloud halos')
      return mod.revoke(config, name)
    }

    case 'down': {
      const name = requireName(
        rest,
        `usage: realness <env> halo down <name> [--delete]`
      )
      if (flags.delete && !flags['no-drain'] && !is_local(config))
        return drain.drain(target, config, name, {
          delete: true,
          fleet: fleet_reader(envName)
        })

      if (flags.delete)
        return mod.down(target, config, name, { mode: 'delete' })
      const sync = await reads.reader(envName)
      await reads.record_intent(sync, name, 'stopping')
      const done = await mod.down(target, config, name, { mode: 'stop' })
      await reads.record_intent(sync, name, 'parked')
      return done
    }

    case 'restart': {
      const name = requireName(
        rest,
        'usage: realness <env> halo restart <name>'
      )
      return with_intent(envName, name, () => mod.restart(target, config, name))
    }

    case 'drain': {
      if (is_local(config))
        throw new Error(
          "there is nothing to drain in dev: the halo is this Mac's VM"
        )

      const name = requireName(
        rest,
        'usage: realness development halo drain <name> [--delete]'
      )
      return drain.drain(target, config, name, {
        delete: Boolean(flags.delete)
      })
    }

    case 'list':
      return listHalos(target, config, hosts.kind)

    case 'status': {
      const records = await halo_status(envName, rest[0])
      return { records, text: format_status(records) }
    }

    default:
      throw new Error(`unknown halo command "${action ?? ''}"\n\n${USAGE}`)
  }
}

const listHalos = async (target, config, kind) => {
  step(`${kind} halos in ${config.project ?? config.vm}`)
  if (kind === 'lima') return { halo: config.vm }

  const names = await target.value(
    ['instances', 'list', '--filter=labels.app=realness'],
    'value(name,status,zone.basename())'
  )
  for (const line of names.split('\n').filter(Boolean)) note(line)
  return { hosts: names.split('\n').filter(Boolean) }
}

/**
 * Show what a command produced, or exit non-zero.
 *
 * A probe that found nothing is a failure; a drain that shipped nothing is not.
 * The command decides by returning counts or throwing.
 */
const finish = value => {
  if (value?.records) {
    result(value.records, value.text)
    return 0
  }
  if (json_output) {
    result(value ?? { ok: true }, '')
    return value?.ok && value.ok.length === 0 ? 1 : 0
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(
      ([, value]) => value !== null && value !== undefined && value !== false
    )
    if (entries.length > 0) {
      process.stdout.write('\n')
      for (const [key, value] of entries) note(`${key}: ${format(value)}`)
    }
    if (value.ok && value.ok.length === 0) return 1
  }
  return 0
}

const format = value => {
  if (value === true) return 'yes'
  if (Array.isArray(value)) return value.join(' ') || 'none'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

main(process.argv.slice(2))
  .then(code => process.exit(code ?? 0))
  .catch(error => {
    if (json_output) result({ error: error.message, code: error.code ?? 1 }, '')
    else process.stderr.write(mask_phones(`realness: ${error.message}\n`))
    if (error.code) process.stderr.write(`exit ${error.code}\n`)
    process.exit(1)
  })
