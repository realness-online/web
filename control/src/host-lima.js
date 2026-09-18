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
 * to create: the VM's own filesystem holds the sessions volume.
 */
import { join } from "node:path"
import { attempt, step, note } from "./exec.js"
import { ROOT } from "./paths.js"
import { waitForHealth } from "./api.js"

export async function up(lima, config, name, { smoke = false } = {}) {
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
  await lima.streamScript("guest-setup.sh")

  step("boot check")
  await lima.streamScript("boot-check.sh")

  step("start the stack")
  const started = await startStack(lima, config)
  note(started.alreadyUp ? "already up" : "started")

  if (smoke) {
    step("smoke test")
    await lima.streamScript("host-smoke.sh", { user: "root" })
  }

  const health = await waitForHealth(config.api, { tries: 90, delayMs: 2000 })
  return {
    host: config.vm,
    api: `${config.api}/v1/health`,
    terminal: `http://127.0.0.1:${config.webPort}/`,
    seed: health.seed?.built ? "built" : "missing",
    sessions: countOf(health.sessions),
  }
}

/** Put the code on the host. In dev it is already there: the Mac's directory is
 *  mounted at /mnt/fc, so there is nothing to copy. */
export async function push(lima, config, name) {
  step("code")
  note(`${join(ROOT)} is mounted at ${config.workdir}; nothing to copy`)
  return { copied: false }
}

/** Start the orchestrator, if it is not already answering. */
export async function serve(lima, config, name) {
  return startStack(lima, config)
}

/** Stop the orchestrator and any microVM it left running. */
export async function down(lima, config, name, { mode = "stop" } = {}) {
  step(`stopping the dev stack${mode === "delete" ? " and the Lima VM" : ""}`)
  await lima.run(
    'pkill -f "[p]ython3 -m orchestrator" || true; pkill -x firecracker || true',
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

export async function restart(lima, config, name) {
  await down(lima, config, name)
  return serve(lima, config, name)
}

/**
 * The stack: sessions volume, TAP, API.
 *
 * `scripts/dev-stack.sh` does all three and `exec`s into the orchestrator, so
 * it is started detached - the orchestrator outlives this command and limactl
 * must not wait for a process that never exits.
 */
async function startStack(lima, config, { fresh = false } = {}) {
  const health = await probeHealth(config.api)
  if (health && !fresh) return { alreadyUp: true, health }

  const prefix = fresh ? "env FRESH=1 " : ""
  const command =
    `mkdir -p ${config.workdir}/dist && nohup ${prefix}bash ` +
    `${config.workdir}/scripts/dev-stack.sh > ${config.workdir}/dist/dev-up.log 2>&1 &`
  await lima.run(command, { user: "root", timeout: 30_000 })
  return { alreadyUp: false, health: await waitForHealth(config.api, { tries: 90, delayMs: 2000 }) }
}

async function probeHealth(api) {
  try {
    const { stdout } = await attempt("curl", ["-sf", "--max-time", "3", `${api}/v1/health`])
    const health = JSON.parse(stdout)
    return health.seed?.built ? health : null
  } catch {
    return null
  }
}

function countOf(sessions) {
  const counts = Object.entries(sessions ?? {})
    .map(([state, n]) => `${n} ${state}`)
    .join(", ")
  return counts || "none"
}