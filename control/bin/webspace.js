#!/usr/bin/env node
/**
 * webspace - run hosts, and the sessions in them.
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
 *   webspace <env> host drain <name> [--delete]   export every session to the bucket
 *   webspace <env> host list
 *   webspace <env> probe [<type>:<zone> ...]      which zones can make a host now
 *
 * The environment is the first word and is required: no default and no
 * environment variable, so a typo fails instead of running against prod.
 */
import { environment, isLocal } from "../webspace.config.js"
import { gcloud } from "../src/cloud.js"
import { limaTarget } from "../src/lima.js"
import { note, step } from "../src/exec.js"
import * as dev from "../src/dev.js"
import * as hostGcp from "../src/host-gcp.js"
import * as hostLima from "../src/host-lima.js"
import * as drain from "../src/drain.js"
import { probe } from "../src/probe.js"

const USAGE = `usage: webspace <dev|prod> <command> [options]

  setup                        dev only: the Lima VM, artifacts, a boot check
  build                        dev only: stage the harness, build the template

  host up [<name>] [--smoke]   make a host, put the code on it, serve (~3 min in GCP)
  host restart <name>          push the code and re-serve
  host down <name> [--delete]  park it, or drain and delete
  host drain <name> [--delete] export every session to the bucket
  host list                    the hosts this environment has

  probe [<type>:<zone> ...]    prod only: which zones can make a host right now

  dev:  host up                       lima start, guest-setup, dev-stack
  prod: host up brayness-2 --smoke    disk, instance, volume, bootstrap, smoke, serve
`

/** Flags come after the subcommand; only a few are booleans. */
function parseFlags(args) {
  const flags = {}
  const rest = []
  for (const arg of args) {
    if (arg.startsWith("--")) flags[arg.slice(2)] = true
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
  const [envName, ...tail] = argv
  if (!envName || envName === "--help" || envName === "-h") {
    process.stdout.write(USAGE)
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
      return mod.up(target, config, rest[0], { smoke: Boolean(flags.smoke) })

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
        // stored. Dev has friends on one machine, not sessions to preserve.
        throw new Error("there is nothing to drain in dev: the host is this Mac's VM")
      }
      const name = requireName(rest, "usage: webspace prod host drain <name> [--delete]")
      return drain.drain(target, config, name, { delete: Boolean(flags.delete) })
    }

    case "list":
      return listHosts(target, config, hosts.kind)

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
function finish(result) {
  if (result && typeof result === "object") {
    const entries = Object.entries(result).filter(
      ([, value]) => value !== null && value !== undefined && value !== false,
    )
    if (entries.length > 0) {
      process.stdout.write("\n")
      for (const [key, value] of entries) note(`${key}: ${format(value)}`)
    }
    if (result.ok && result.ok.length === 0) return 1
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
    process.stderr.write(`\nwebspace: ${error.message}\n`)
    if (error.code) process.stderr.write(`exit ${error.code}\n`)
    process.exit(1)
  })