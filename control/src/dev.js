/**
 * The dev environment's own commands: setup and build.
 *
 * `host up`, `host down`, `host restart`, and `host drain` are the same verbs in
 * every environment and live in host-gcp.js and host-lima.js. What is left here
 * is the two things only a local host needs: making the Linux VM and its
 * artifacts, and building the template.
 *
 * The steps stay bash. Node is not installed in the guest, and these are root
 * syscalls - mkfs, mount, chroot - which shell expresses directly.
 */
import { join } from "node:path"
import { ROOT } from "./paths.js"

/**
 * Once per Mac: the Lima VM, the firecracker artifacts, a boot check.
 * Idempotent, so it is also the way to prove a guest still works.
 */
export async function setup(lima) {
  const { step, note } = await import("./exec.js")

  step(`lima: ${lima.config.vm}`)
  note(await lima.start(join(ROOT, "lima", "fc-local.yaml")))

  step("firecracker, kernel, rootfs")
  await lima.streamScript("control/scripts/guest-setup.sh")

  step("boot check")
  await lima.streamScript("control/scripts/boot-check.sh")
  return { host: lima.config.vm, ready: true }
}

/** Stage the harness and build template.ext4. */
export async function build(lima) {
  const { stream, step, note } = await import("./exec.js")

  step("stage the harness")
  await stream("bash", [join(ROOT, "control", "scripts", "harness-stage.sh")])

  step("fetch the agent pass")
  await stream("bash", [join(ROOT, "control", "scripts", "agent-pass.sh")])

  step("build the template in the guest")
  await lima.streamScript("control/scripts/template-build.sh", { user: "root" })

  note("after a rebuild the seed is stale: webspace dev host up --fresh")
  return { rebuilt: true }
}