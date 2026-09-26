/**
 * A session host: create it, put code on it, take it away.
 *
 *   webspace prod host up brayness-2 [--smoke]
 *   webspace prod host down brayness-2 [--delete] [--no-drain]
 *   webspace prod host restart brayness-2
 *
 * The host has no credentials at all - it is created with --no-service-account
 * - so it cannot upload its own bundles and cannot be trusted to decide it is
 * safe to die. Everything here is the Mac acting on it from outside.
 *
 * Everything is named explicitly. `gcloud instances create` will silently
 * attach an existing disk that shares the instance's name instead of creating
 * one, which is how a 20 GB request once booted a 100 GB disk.
 */
import { join } from "node:path"
import { attempt, step, note } from "./exec.js"
import { ROOT } from "./paths.js"
import { buildTerminal } from "./terminal.js"

const bootDisk = (name) => `${name}-boot`
const sessionsDisk = (name) => `${name}-sessions`

/** Config supplies the sizes; a call may override any of them. */
function sizes(config, options) {
  return {
    imageFamily: options.imageFamily ?? config.imageFamily,
    machineType: options.machineType ?? config.machineType,
    bootSize: options.bootSize ?? config.bootSize,
    sessionsSize: options.sessionsSize ?? config.sessionsSize,
  }
}

export async function up(cloud, config, name, { smoke = false, ...options } = {}) {
  const { imageFamily, machineType, bootSize, sessionsSize } = sizes(config, options)
  const boot = bootDisk(name)
  const sessions = sessionsDisk(name)

  step("names must be free")
  // A collision means two things answer to one name, and gcloud's behaviour is
  // to reuse the disk rather than fail. Refuse instead.
  for (const resource of [
    ["disks", "describe", boot],
    ["instances", "describe", name],
    ["disks", "describe", sessions],
  ]) {
    if (await cloud.exists(resource)) {
      throw new Error(`${resource.join(" ")} already exists - pick another name`)
    }
  }
  note(`${name}, ${boot}, ${sessions}: all free`)

  step(`boot disk ${boot} (${bootSize}, image family ${imageFamily})`)
  await cloud.stream([
    "disks",
    "create",
    boot,
    `--size=${bootSize}`,
    "--type=pd-standard",
    `--image-family=${imageFamily}`,
    "--labels=app=brayness,role=session-host",
  ])

  step(`instance ${name} (${machineType}, nested virt, no service account)`)
  // A failed create must not leave the disk it just made behind to bill
  // unattached. A zone with no capacity is the usual failure.
  const created = await cloud.try([
    "instances",
    "create",
    name,
    `--machine-type=${machineType}`,
    "--enable-nested-virtualization",
    `--disk=name=${boot},boot=yes,auto-delete=yes`,
    "--no-service-account",
    "--no-scopes",
    "--tags=brayness-host",
    "--labels=app=brayness,role=session-host",
  ])
  if (!created.ok) {
    note(lastLine(created.err))
    note(`removing ${boot}`)
    await cloud.try(["disks", "delete", boot, "--quiet"])
    throw new Error(`instance create failed: ${lastLine(created.err)}`)
  }
  note("created")

  step("waiting for ssh")
  for (let i = 0; i < 40; i += 1) {
    const result = await cloud.try(["ssh", name, "--quiet", "--command=true"])
    if (result.ok) break
    if (i % 5 === 0) note(`${i * 5}s`)
    await pause(5000)
    if (i === 39) throw new Error(`${name} never answered ssh`)
  }
  const block = await cloud.value(["ssh", name, "--quiet", "--command=lsblk -no NAME,SIZE,TYPE /dev/sda"])
  note(block.split("\n").slice(-2).join("  "))

  step(`sessions volume ${sessions} (${sessionsSize})`)
  await cloud.stream([
    "disks",
    "create",
    sessions,
    `--size=${sessionsSize}`,
    "--type=pd-standard",
    "--labels=app=brayness,role=sessions",
  ])
  // Device name, not resource name, decides /dev/disk/by-id/google-<device>,
  // which is what sessions-volume.sh looks for. It is per-instance, so every
  // host uses the same.
  await cloud.stream([
    "instances",
    "attach-disk",
    name,
    `--disk=${sessions}`,
    "--device-name=brayness-sessions",
  ])

  step("bootstrap on the host")
  await push(cloud, name)
  await cloud.ssh(name, `sudo bash ${config.root}/host/scripts/host-bootstrap.sh`)

  if (smoke) {
    step("smoke test")
    await cloud.ssh(name, `bash ${config.root}/host/scripts/host-smoke.sh`)
  }

  await serve(cloud, config, name)
  return summary(cloud, config, name)
}

/** Stop it, keeping the disks. A start serves again in seconds. */
export async function down(cloud, config, name, { mode = "stop" } = {}) {
  if (mode === "delete") {
    step(`deleting ${name} and ${sessionsDisk(name)}`)
    // The boot disk has auto-delete, so deleting the instance takes it too.
    await cloud.stream(["instances", "delete", name, "--quiet"])
    const volume = await cloud.try(["disks", "delete", sessionsDisk(name), "--quiet"])
    if (!volume.ok) note(`no ${sessionsDisk(name)} volume`)
  } else {
    step(`stopping ${name} (disks kept)`)
    await cloud.stream(["instances", "stop", name, "--quiet"])
    for (let i = 0; i < 30; i += 1) {
      if ((await cloud.value(["instances", "describe", name])) === "TERMINATED") break
      await pause(5000)
    }
    note(`${name}: ${await cloud.value(["instances", "describe", name])}`)
  }

  step(`left in ${config.zone}`)
  process.stdout.write(
    await cloud.call(["disks", "list", "--format=table(name,sizeGb,type.basename(),users.basename())"]),
  )
}

/**
 * Copy the working tree up.
 *
 * The image carries a copy of both directories, but the code is the thing that
 * changes, so the host gets the local working copies rather than whatever was
 * baked in. The host runs as root and leaves a root-owned
 * __pycache__, which makes the next scp fail, so hand the tree back first.
 */
export async function push(cloud, name) {
  await buildTerminal()
  step("copy the code")
  await cloud.ssh(name, "sudo chown -R $(whoami):$(whoami) ~/brayness")
  for (const dir of ["host"]) {
    await cloud.stream(["scp", "--recurse", join(ROOT, dir), `${name}:~/brayness/`])
  }
}

/** Start the host on the host, by path. */
export async function serve(cloud, config, name) {
  step("serve")
  // By path, not inline: an ssh command line holding a pkill pattern would
  // kill the shell running the ssh command.
  await cloud.ssh(name, `bash ${config.root}/host/scripts/host-restart.sh`)
}

export async function restart(cloud, config, name) {
  await push(cloud, name)
  await serve(cloud, config, name)
  return summary(cloud, config, name)
}

async function summary(cloud, config, name) {
  return {
    name,
    ip: await cloud.ip(name),
    tunnel: `gcloud compute ssh ${name} --zone=${config.zone} -- -N -L 8090:127.0.0.1:8090`,
    park: `webspace prod host down ${name}`,
    drop: `webspace prod host down ${name} --delete`,
  }
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function lastLine(text) {
  return (
    text
      .trim()
      .split("\n")
      .filter(line => !line.startsWith("WARNING"))
      .pop()
      ?.trim() ?? ""
  )
}

export { attempt }