/**
 * A host made by Lima, on this Mac.
 *
 * The same four verbs as a GCP host - make it, put the code on it, serve, take
 * it away - against a Linux VM instead of an instance. Firecracker needs
 * /dev/kvm and macOS has none, so the dev host is a Lima VM with nested
 * virtualization.
 *
 * The steps are the same scripts a GCP host runs. What differs is the transport
 * (`limactl shell` rather than `gcloud compute ssh`) and that Lima has no disks
 * to create: the VM's own filesystem holds the actors volume.
 */
import { join } from "node:path"
import { attempt, step, note } from "./exec.js"
import { ROOT } from "./paths.js"
import { buildTerminal as build_terminal } from "./terminal.js"
import { waitForHealth as wait_for_health } from "./api.js"
import { provision_record_key } from "./host-gcp.js"

/** The dev host writes its records to the cloud sync, like a prod host. */
const register = async (lima, config) => {
  const name = (await lima.run("hostname")).trim()
  await provision_record_key(null, config, name, {
    read_secret: () => lima.run(`bash ${config.workdir}/host/scripts/record-key.sh`, { user: "root" }),
  })
}

export const up = async (lima, config, name, { smoke = false, fresh = false } = {}) => {
  if (name && name !== config.vm) {
    // One Lima VM per environment, named in the config. A second would need its
    // own config block, which is a real thing to add but not this command.
    throw new Error(
      `dev has one Lima host, "${config.vm}". To use "${name}", add a config block for it.`,
    )
  }

  step(`lima: ${config.vm}`)
  note(await lima.start(join(ROOT, "lima", "fc-local.yaml")))

  step("firecracker, kernel, rootfs")
  await lima.streamScript("control/scripts/guest-setup.sh")

  step("boot check")
  await lima.streamScript("control/scripts/boot-check.sh")

  await build_terminal()

  // --fresh wipes the actors volume, so the seed rebuilds from the new template.
  if (fresh) await down(lima, config, name)
  await register(lima, config)
  step("start the stack")
  const started = await startStack(lima, config, { fresh })
  note(started.alreadyUp ? "already up" : "started")

  if (smoke) {
    step("smoke test")
    await lima.streamScript("host/scripts/host-smoke.sh", { user: "root" })
  }

  const health = await wait_for_health(config.api, { tries: 90, delayMs: 2000 })
  return {
    host: config.vm,
    api: `${config.api}/v1/health`,
    terminal: `http://127.0.0.1:${config.webPort}/`,
    seed: health.seed?.built ? "built" : "missing",
    actors: countOf(health.actors),
  }
}

/** Put the code on the host. In dev it is already there: the Mac's directory is
 *  mounted at /mnt/fc, so there is nothing to copy. */
export const push = async (lima, config, name) => {
  step("code")
  note(`${join(ROOT)} is mounted at ${config.workdir}; nothing to copy`)
  return { copied: false }
}

/** Start the host, if it is not already answering. */
export const serve = async (lima, config, name) => {
  return startStack(lima, config)
}

/** Stop the host and any microVM it left running. */
export const down = async (lima, config, name, { mode = "stop" } = {}) => {
  step(`stopping the dev stack${mode === "delete" ? " and the Lima VM" : ""}`)
  await lima.run(
    'pkill -f "[n]ode host/main.js" || true; pkill -x firecracker || true',
    { user: "root" },
  )

  if (mode === "delete") {
    // There are no billable disks to leave; `limactl stop` is as far as this
    // goes. Deleting the VM would delete the dev environment's whole rootfs.
    await attempt("limactl", ["stop", config.vm])
    note(`${config.vm} stopped (not deleted: it is the dev environment)`)
  }
  return { stopped: true, deleted: mode === "delete" }
}

export const restart = async (lima, config, name) => {
  const health = await probeHealth(config.api)
  if (health?.actors?.running) throw new Error(`${health.actors.running} actor(s) running; stop them before restarting the dev host`)
  await build_terminal()
  await down(lima, config, name)
  await register(lima, config)
  return serve(lima, config, name)
}

/**
 * The stack: actors volume, TAP, API.
 *
 * `control/scripts/dev-stack.sh` does all three and `exec`s into the host, so
 * it is started detached - the host outlives this command and limactl
 * must not wait for a process that never exits.
 */
const startStack = async (lima, config, { fresh = false } = {}) => {
  const health = await probeHealth(config.api)
  if (health && !fresh) return { alreadyUp: true, health }

  const prefix = fresh ? "env FRESH=1 " : ""
  const command =
    `mkdir -p ${config.workdir}/dist && nohup ${prefix}bash ` +
    `${config.workdir}/control/scripts/dev-stack.sh > ${config.workdir}/dist/dev-up.log 2>&1 &`
  await lima.run(command, { user: "root", timeout: 30_000 })
  return { alreadyUp: false, health: await wait_for_health(config.api, { tries: 90, delayMs: 2000 }) }
}

const probeHealth = async (api) => {
  try {
    const { stdout } = await attempt("curl", ["-sf", "--max-time", "3", `${api}/v1/health`])
    const health = JSON.parse(stdout)
    return health.seed?.built ? health : null
  } catch {
    return null
  }
}

const countOf = (actors) => {
  const counts = Object.entries(actors ?? {})
    .map(([state, n]) => `${n} ${state}`)
    .join(", ")
  return counts || "none"
}