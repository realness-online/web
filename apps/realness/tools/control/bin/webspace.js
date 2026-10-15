#!/usr/bin/env node
/**
 * realness - run hosts, and the actors in them.
 *
 * An environment says *where hosts live*, not *which command you may run*:
 *
 *   local        a Linux VM on this Mac, made by Lima
 *   development  a VM in realness-development, made by gcloud
 *
 * Both implement the same verbs, so every command works in either and only the
 * meaning of "a host" changes.
 *
 *   realness local setup                      once per Mac: the Lima VM and artifacts
 *   realness local build                      stage the harness, build the template
 *
 *   realness <env> host up [<name>] [--smoke]     make a host, put the code on it, serve
 *   realness <env> host restart <name>            push the code and re-serve
 *   realness <env> host down <name> [--delete] [--no-drain]
 *   realness <env> host drain <name> [--delete]   export every actor to the bucket
 *   realness <env> host list
 *   realness <env> host status [<name>] [--json]
 *   realness <env> probe [<type>:<zone> ...]      which zones can make a host now
 *
 * The environment is the first word and is required: no default and no
 * environment variable, so a typo fails instead of running somewhere unintended.
 */
import { cloud_text as reconcile_cloud_text, reconcile_cloud, reconcile_models, reconcile_text } from "../../../src/control/reconcile.js"
import { environment, isLocal as is_local } from "../webspace.config.js"
import { gcloud } from "../../../src/control/cloud.js"
import { limaTarget as lima_target } from "../../../src/control/lima.js"
import { note, step } from "../../../src/control/exec.js"
import * as dev from "../../../src/control/dev.js"
import {
  up as gcp_up,
  down as gcp_down,
  restart as gcp_restart,
} from "../../../src/control/host-gcp.js"
import {
  up as lima_up,
  down as lima_down,
  restart as lima_restart,
} from "../../../src/control/host-lima.js"
import * as drain from "../../../src/control/drain.js"
import { probe } from "../../../src/control/probe.js"
import { host_status, format_status } from "../../../src/control/status.js"
import { set_json_output, result, mask_phones } from "../../../src/control/output.js"
import { admin_login, admin_identity, admin_logout } from "../../../src/control/auth.js"
import * as reads from "../../../src/control/reads.js"
import { OPERATOR_START_MS } from "../../../src/sync/host-lifecycle.js"
import * as cloud from "../../../src/control/cloud-reads.js"
import { gather, overview_text } from "../../../src/control/overview.js"
import { attention } from "../../../src/control/attention.js"
import { manage_admins, ensure_admins, admins_text } from "../../../src/control/admins.js"
import { local_person } from "#root/src/harness/settings.js"
import { project_root } from "#root/src/settings/layout.js"
import { join } from "node:path"
import { disk } from "../../../src/can/disk.js"
import { create_gcs, gcloud_token } from "../../../src/can/gcs.js"
import { deployment_settings } from "#root/src/settings/environments.js"
import { out_path } from "#root/src/settings/output.js"

let json_output = false

const USAGE = `usage: realness <local|development> <command> [options]

  setup                        local only: the Lima VM, artifacts, a boot check
  build                        local only: stage the harness, build the template

  host up [<name>] [--smoke] [--expire=2h]  make a host, put the code on it, serve (~3 min in GCP)
  host restart <name>          push the code and re-serve
  host down <name> [--delete]  park it, or drain and delete
  host drain <name> [--delete] export every actor to the bucket
  host list                    the hosts this environment has
  host status [<name>] [--json] read last-seen host records through sync

  admin login|logout|whoami    browser sign-in; sync verifies admin access
  admins list                  who sync treats as a global admin (admins.html)
  admins init                  first admin from person.local.html, only if none exist
  admins add <phone> [name] [--yes]   dry-run unless --yes; bucket credentials
  admins remove <phone> [--yes]       refuses to remove the last admin
  actor list | actor show <id> actors from the hosts' last reports
  actor idle|stop <id>         ask its host; idle keeps memory, stop keeps disk
  loop list | loop show <id>   loop records
  loop stop <id>               ask the host to stop the loop
  person <phone>               one person's actors, loops, and usage
  usage <phone> [--day=DATE]   one UTC day of the ledger; default today
  limit <phone>                limits, use, and what is left: today and month
  status                       everything at once, attention last; exits 2 on attention
  service list                 Cloud Run services: ready, revision, deployed
  logs <service> [--since=1h] [--errors] [--limit=50]
  cost [--days=7]              billed cost from the billing export
  reconcile                    ledger vs OpenRouter; GCP bill vs expected services and spikes
  --json                      one JSON result; progress goes to stderr

  probe [<type>:<zone> ...]    development only: which zones can make a host right now

  local: host up                       lima start, guest-setup, dev-stack
  development: host up realness-2 --smoke    disk, instance, volume, bootstrap, smoke, serve
`

/** Flags come after the subcommand; only a few are booleans. */
const parseFlags = (args) => {
  const flags = {}
  const rest = []
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, ...value] = arg.slice(2).split("=")
      flags[key] = value.length ? value.join("=") : true
    }
    else rest.push(arg)
  }
  return { flags, rest }
}

/** A host name is required for everything but `up`. */
const requireName = (rest, usage) => {
  const name = rest[0]
  if (!name) throw new Error(usage)
  return name
}

const main = async (argv) => {
  json_output = argv.includes("--json")
  set_json_output(json_output)
  const [envName, ...tail] = argv.filter((arg) => arg !== "--json")
  if (!envName || envName === "--help" || envName === "-h" || tail.includes("--help") || tail.includes("-h")) {
    result({ usage: USAGE }, USAGE.trimEnd())
    return 0
  }

  const config = environment(envName)
  const local = is_local(config)
  const { flags, rest } = parseFlags(tail)
  const [command, ...args] = rest

  const hosts = local
    ? {
        kind: "lima",
        target: lima_target(config),
        mod: { up: lima_up, down: lima_down, restart: lima_restart },
      }
    : {
        kind: "gcp",
        target: gcloud(config),
        mod: { up: gcp_up, down: gcp_down, restart: gcp_restart },
      }

  switch (command) {
    case "setup":
      if (!local) throw new Error("setup makes the local Lima VM; there is nothing to set up in prod")
      return finish(await dev.setup(hosts.target))

    case "build":
      if (!local) throw new Error("build makes the local template; cloud hosts boot the fleet image")
      return finish(await dev.build(hosts.target))

    case "host":
      return finish(await hostCommand(hosts, config, args, flags, envName))

    case "admin": {
      if (args.length !== 1) throw new Error("usage: realness <env> admin login|logout|whoami")
      if (args[0] === "login") return finish(await admin_login(envName))
      if (args[0] === "logout") return finish(await admin_logout())
      if (args[0] === "whoami") return finish(await admin_identity(envName))
      throw new Error("usage: realness <env> admin login|logout|whoami")
    }

    case "admins": {
      const [verb = "list", phone, ...name] = args
      const usage = "usage: realness <env> admins list | init | add <phone> [name] | remove <phone> [--yes]"
      const bare = verb === "list" || verb === "init"
      if (!['list', 'init', 'add', 'remove'].includes(verb) || (bare ? args.length > 1 : !phone)) throw new Error(usage)
      const storage = local
        ? disk(typeof flags.dir === "string" ? flags.dir : out_path("site-sync"))
        : create_gcs({ bucket: deployment_settings(envName, process.env).bucket, token: gcloud_token })
      const harness = typeof flags.harness === "string" ? flags.harness : join(project_root, "../..")
      const done = verb === "init"
        ? await ensure_admins(storage, [local_person(harness)], { create_only: true })
        : await manage_admins(storage, { verb, phone, name: name.join(" "), yes: flags.yes === true })
      return finish({ records: done, text: admins_text(done, { verb }) })
    }

    case "actor":
    case "loop": {
      const [verb, id] = args
      const writes = command === "actor" ? ["idle", "stop"] : ["stop"]
      const usage = `usage: realness <env> ${command} list | ${command} show|${writes.join("|")} <id>`
      if (args.length > 2 || !(verb === "list" ? !id : id && (verb === "show" || writes.includes(verb)))) throw new Error(usage)
      const sync = await reads.reader(envName)
      if (writes.includes(verb)) {
        const done = command === "actor" ? await reads.request_actor(sync, id, verb) : await reads.request_loop_stop(sync, id)
        return finish(done)
      }
      const rows = command === "actor" ? await reads.actors(sync, id) : await reads.loops(sync, id)
      return finish({ records: rows, text: reads.text[`${command}s`](rows) })
    }

    case "person": {
      const found = await reads.person(await reads.reader(envName), args[0], { day: flags.day })
      return finish({ records: found, text: reads.text.person(found) })
    }

    case "limit": {
      const found = await reads.limit(await reads.reader(envName), args[0])
      return finish({ records: found, text: reads.text.limit(found) })
    }

    case "usage": {
      const found = await reads.usage(await reads.reader(envName), args[0], flags.day)
      return finish({ records: found, text: reads.text.usage(found) })
    }

    case "status": {
      if (args.length) throw new Error("usage: realness <env> status [--json]")
      const now = Date.now()
      const sync = await reads.reader(envName)
      const view = await gather({ sync, config, now })
      const lines = attention(view, config.attention, now)
      result({ ...view, attention: lines }, overview_text(view, lines))
      return lines.length ? 2 : 0
    }

    case "service": {
      if (args.length !== 1 || args[0] !== "list") throw new Error("usage: realness <env> service list")
      const rows = await cloud.services(config.cloud)
      return finish({ records: rows, text: cloud.cloud_text.services(rows) })
    }

    case "logs": {
      if (args.length !== 1) throw new Error("usage: realness <env> logs <service> [--since=1h] [--errors] [--limit=50]")
      const rows = await cloud.logs(config.cloud, args[0], { since: flags.since ?? "1h", errors: flags.errors === true, limit: flags.limit ?? 50 })
      return finish({ records: rows, text: cloud.cloud_text.logs(rows) })
    }

    case "cost": {
      const projects = [...new Set([config.cloud.project, config.project].filter(Boolean))]
      const found = await cloud.cost(config.cloud, projects, { days: flags.days ?? 7 })
      return finish({ records: found, text: cloud.cloud_text.cost(found) })
    }

    case "reconcile": {
      if (args.length) throw new Error("usage: realness <env> reconcile")
      const [models, gcp] = await Promise.allSettled([reconcile_models(await reads.reader(envName), config), reconcile_cloud(config)])
      const settled = result =>
        result.status === "fulfilled"
          ? result.value
          : { error: result.reason?.message ?? String(result.reason) }
      const found = { models: settled(models), gcp: settled(gcp) }
      const part = (r, text) => (r.error ? `  not checked: ${r.error}` : text(r))
      result(found, [part(found.models, reconcile_text), part(found.gcp, reconcile_cloud_text)].join("\n"))
      return (found.models.gaps?.length || found.gcp.gaps?.length) ? 2 : models.status === "rejected" || gcp.status === "rejected" ? 1 : 0
    }

    case "probe":
      if (local) throw new Error("probe asks GCP which zones have capacity; dev has one local host")
      return finish(await probe(config, args))

    default:
      throw new Error(`unknown command "${command ?? ""}"\n\n${USAGE}`)
  }
}

/** Starting before the work, running after; a failed start stays starting until its deadline. */
const with_intent = async (envName, name, work) => {
  if (!name) return work()
  const sync = await reads.reader(envName)
  await reads.record_intent(sync, name, "starting", { deadline_ms: OPERATOR_START_MS })
  const done = await work()
  await reads.record_intent(sync, name, "running")
  return done
}

const hostCommand = async (hosts, config, args, flags, envName) => {
  const [action, ...rest] = args
  const { target, mod } = hosts

  switch (action) {
    case "up":
      return with_intent(envName, rest[0], () =>
        mod.up(target, config, rest[0], {
          smoke: Boolean(flags.smoke),
          fresh: Boolean(flags.fresh),
          ...(typeof flags.expire === "string" && { expire: flags.expire }),
        }),
      )

    case "down": {
      const name = requireName(rest, `usage: realness <env> host down <name> [--delete]`)
      if (flags.delete && !flags["no-drain"] && !is_local(config)) {
        return drain.drain(target, config, name, { delete: true })
      }
      if (flags.delete) return mod.down(target, config, name, { mode: "delete" })
      const sync = await reads.reader(envName)
      await reads.record_intent(sync, name, "stopping")
      const done = await mod.down(target, config, name, { mode: "stop" })
      await reads.record_intent(sync, name, "parked")
      return done
    }

    case "restart": {
      const name = requireName(rest, "usage: realness <env> host restart <name>")
      return with_intent(envName, name, () => mod.restart(target, config, name))
    }

    case "drain": {
      if (is_local(config)) {
        throw new Error("there is nothing to drain in dev: the host is this Mac's VM")
      }
      const name = requireName(rest, "usage: realness development host drain <name> [--delete]")
      return drain.drain(target, config, name, { delete: Boolean(flags.delete) })
    }

    case "list":
      return listHosts(target, config, hosts.kind)

    case "status": {
      const records = await host_status(envName, rest[0])
      return { records, text: format_status(records) }
    }

    default:
      throw new Error(`unknown host command "${action ?? ""}"\n\n${USAGE}`)
  }
}

const listHosts = async (target, config, kind) => {
  step(`${kind} hosts in ${config.project ?? config.vm}`)
  if (kind === "lima") return { host: config.vm }

  const names = await target.value(["instances", "list", "--filter=labels.app=realness"], "value(name,status,zone.basename())")
  for (const line of names.split("\n").filter(Boolean)) note(line)
  return { hosts: names.split("\n").filter(Boolean) }
}

/**
 * Show what a command produced, or exit non-zero.
 *
 * A probe that found nothing is a failure; a drain that shipped nothing is not.
 * The command decides by returning counts or throwing.
 */
const finish = (value) => {
  if (value?.records) {
    result(value.records, value.text)
    return 0
  }
  if (json_output) {
    result(value ?? { ok: true }, "")
    return value?.ok && value.ok.length === 0 ? 1 : 0
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([, value]) => value !== null && value !== undefined && value !== false,
    )
    if (entries.length > 0) {
      process.stdout.write("\n")
      for (const [key, value] of entries) note(`${key}: ${format(value)}`)
    }
    if (value.ok && value.ok.length === 0) return 1
  }
  return 0
}

const format = (value) => {
  if (value === true) return "yes"
  if (Array.isArray(value)) return value.join(" ") || "none"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

main(process.argv.slice(2))
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    if (json_output) result({ error: error.message, code: error.code ?? 1 }, "")
    else process.stderr.write(mask_phones(`realness: ${error.message}\n`))
    if (error.code) process.stderr.write(`exit ${error.code}\n`)
    process.exit(1)
  })