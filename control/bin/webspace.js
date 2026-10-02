#!/usr/bin/env node
/**
 * webspace - run hosts, and the actors in them.
 *
 * An environment says *where hosts live*, not *which command you may run*:
 *
 *   dev    a Linux VM on this Mac, made by Lima
 *   prod   a VM in GCP, made by gcloud
 *
 * Both implement the same verbs, so every command works in either and only the
 * meaning of "a host" changes.
 *
 *   webspace dev  setup                     once per Mac: the Lima VM and artifacts
 *   webspace dev  build                     stage the harness, build the template
 *
 *   webspace <env> host up [<name>] [--smoke]     make a host, put the code on it, serve
 *   webspace <env> host restart <name>            push the code and re-serve
 *   webspace <env> host down <name> [--delete] [--no-drain]
 *   webspace <env> host drain <name> [--delete]   export every actor to the bucket
 *   webspace <env> host list
 *   webspace <env> host status [<name>] [--json]
 *   webspace <env> probe [<type>:<zone> ...]      which zones can make a host now
 *
 * The environment is the first word and is required: no default and no
 * environment variable, so a typo fails instead of running against prod.
 */
import { cloud_text as reconcile_cloud_text, reconcile_cloud, reconcile_models, reconcile_text } from "../src/reconcile.js"
import { environment, isLocal } from "../webspace.config.js"
import { gcloud } from "../src/cloud.js"
import { limaTarget } from "../src/lima.js"
import { note, step } from "../src/exec.js"
import * as dev from "../src/dev.js"
import * as hostGcp from "../src/host-gcp.js"
import * as hostLima from "../src/host-lima.js"
import * as drain from "../src/drain.js"
import { probe } from "../src/probe.js"
import { host_status, format_status } from "../src/status.js"
import { set_json_output, result, mask_phones } from "../src/output.js"
import { admin_login, admin_identity, admin_logout } from "../src/auth.js"
import * as reads from "../src/reads.js"
import * as cloud from "../src/cloud-reads.js"
import { gather, overview_text } from "../src/overview.js"
import { attention } from "../src/attention.js"

let json_output = false

const USAGE = `usage: webspace <dev|prod> <command> [options]

  setup                        dev only: the Lima VM, artifacts, a boot check
  build                        dev only: stage the harness, build the template

  host up [<name>] [--smoke]   make a host, put the code on it, serve (~3 min in GCP)
  host restart <name>          push the code and re-serve
  host down <name> [--delete]  park it, or drain and delete
  host drain <name> [--delete] export every actor to the bucket
  host list                    the hosts this environment has
  host status [<name>] [--json] read last-seen host records through sync

  admin login|logout|whoami    browser sign-in; sync verifies admin access
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

  probe [<type>:<zone> ...]    prod only: which zones can make a host right now

  dev:  host up                       lima start, guest-setup, dev-stack
  prod: host up brayness-2 --smoke    disk, instance, volume, bootstrap, smoke, serve
`

/** Flags come after the subcommand; only a few are booleans. */
function parseFlags(args) {
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
function requireName(rest, usage) {
  const name = rest[0]
  if (!name) throw new Error(usage)
  return name
}

async function main(argv) {
  json_output = argv.includes("--json")
  set_json_output(json_output)
  const [envName, ...tail] = argv.filter((arg) => arg !== "--json")
  if (!envName || envName === "--help" || envName === "-h") {
    result({ usage: USAGE }, USAGE.trimEnd())
    return 0
  }

  const config = environment(envName)
  const local = isLocal(config)
  const { flags, rest } = parseFlags(tail)
  const [command, ...args] = rest

  // One object per environment, with the same four verbs. Everything below
  // goes through this, so nothing has to ask which target it is talking to.
  const hosts = local
    ? { kind: "lima", target: limaTarget(config), mod: hostLima }
    : { kind: "gcp", target: gcloud(config), mod: hostGcp }

  switch (command) {
    case "setup":
      if (!local) throw new Error("setup makes the local Lima VM; there is nothing to set up in prod")
      return finish(await dev.setup(hosts.target))

    case "build":
      if (!local) throw new Error("build makes the local template; prod hosts boot the fleet image")
      return finish(await dev.build(hosts.target))

    case "host":
      return finish(await hostCommand(hosts, config, args, flags))

    case "admin": {
      if (args.length !== 1) throw new Error("usage: webspace <env> admin login|logout|whoami")
      if (args[0] === "login") return finish(await admin_login(envName))
      if (args[0] === "logout") return finish(await admin_logout())
      if (args[0] === "whoami") return finish(await admin_identity(envName))
      throw new Error("usage: webspace <env> admin login|logout|whoami")
    }

    case "actor":
    case "loop": {
      const [verb, id] = args
      const writes = command === "actor" ? ["idle", "stop"] : ["stop"]
      const usage = `usage: webspace <env> ${command} list | ${command} show|${writes.join("|")} <id>`
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
      if (args.length) throw new Error("usage: webspace <env> status [--json]")
      const now = Date.now()
      const sync = await reads.reader(envName)
      const view = await gather({ sync, config, now })
      const lines = attention(view, config.attention, now)
      result({ ...view, attention: lines }, overview_text(view, lines))
      return lines.length ? 2 : 0
    }

    case "service": {
      if (args.length !== 1 || args[0] !== "list") throw new Error("usage: webspace <env> service list")
      const rows = await cloud.services(config.cloud)
      return finish({ records: rows, text: cloud.cloud_text.services(rows) })
    }

    case "logs": {
      if (args.length !== 1) throw new Error("usage: webspace <env> logs <service> [--since=1h] [--errors] [--limit=50]")
      const rows = await cloud.logs(config.cloud, args[0], { since: flags.since ?? "1h", errors: flags.errors === true, limit: flags.limit ?? 50 })
      return finish({ records: rows, text: cloud.cloud_text.logs(rows) })
    }

    case "cost": {
      const projects = [...new Set([config.cloud.project, config.project].filter(Boolean))]
      const found = await cloud.cost(config.cloud, projects, { days: flags.days ?? 7 })
      return finish({ records: found, text: cloud.cloud_text.cost(found) })
    }

    case "reconcile": {
      if (args.length) throw new Error("usage: webspace <env> reconcile")
      const [models, gcp] = await Promise.allSettled([reconcile_models(await reads.reader(envName), config), reconcile_cloud(config)])
      const found = { models: models.value ?? { error: models.reason?.message }, gcp: gcp.value ?? { error: gcp.reason?.message } }
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

async function hostCommand(hosts, config, args, flags) {
  const [action, ...rest] = args
  const { target, mod } = hosts

  switch (action) {
    case "up":
      // dev has exactly one host, named in the config, so the name is optional.
      return mod.up(target, config, rest[0], {
        smoke: Boolean(flags.smoke),
        fresh: Boolean(flags.fresh),
      })

    case "down": {
      const name = requireName(rest, `usage: webspace <env> host down <name> [--delete]`)
      if (flags.delete && !flags["no-drain"] && !isLocal(config)) {
        // The drain is the safe delete; --no-drain is the blunt path.
        return drain.drain(target, config, name, { delete: true })
      }
      return mod.down(target, config, name, { mode: flags.delete ? "delete" : "stop" })
    }

    case "restart":
      return mod.restart(
        target,
        config,
        requireName(rest, "usage: webspace <env> host restart <name>"),
      )

    case "drain": {
      if (isLocal(config)) {
        // The drain ships bundles to a bucket and verifies what the bucket
        // stored. Dev has friends on one machine, not actors to preserve.
        throw new Error("there is nothing to drain in dev: the host is this Mac's VM")
      }
      const name = requireName(rest, "usage: webspace prod host drain <name> [--delete]")
      return drain.drain(target, config, name, { delete: Boolean(flags.delete) })
    }

    case "list":
      return listHosts(target, config, hosts.kind)

    case "status": {
      const records = await host_status(isLocal(config) ? "dev" : "prod", rest[0])
      return { records, text: format_status(records) }
    }

    default:
      throw new Error(`unknown host command "${action ?? ""}"\n\n${USAGE}`)
  }
}

async function listHosts(target, config, kind) {
  step(`${kind} hosts in ${config.project ?? config.vm}`)
  if (kind === "lima") return { host: config.vm }

  const names = await target.value([
    "instances",
    "list",
    "--filter=labels.app=brayness",
    "--format=value(name,status,zone.basename())",
  ])
  for (const line of names.split("\n").filter(Boolean)) note(line)
  return { hosts: names.split("\n").filter(Boolean) }
}

/**
 * Show what a command produced, or exit non-zero.
 *
 * A probe that found nothing is a failure; a drain that shipped nothing is not.
 * The command decides by returning counts or throwing.
 */
function finish(value) {
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

function format(value) {
  if (value === true) return "yes"
  if (Array.isArray(value)) return value.join(" ") || "none"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

main(process.argv.slice(2))
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    if (json_output) result({ error: error.message, code: error.code ?? 1 }, "")
    else process.stderr.write(mask_phones(`\nwebspace: ${error.message}\n`))
    if (error.code) process.stderr.write(`exit ${error.code}\n`)
    process.exit(1)
  })