/**
 * Lima, as an object with the methods a local host needs.
 *
 * Every guest call passes --workdir: `limactl shell` mirrors the Mac's cwd into
 * the guest, so a deep path fails with `cd: No such file or directory` before
 * the command runs.
 */
import { run, attempt, stream } from "./exec.js"

export function limaTarget(config) {
  const shellArgs = (command, { user = null } = {}) => {
    const args = ["shell", `--workdir=${config.workdir}`, config.vm]
    if (!command) return args
    if (user === "root") args.push("--", "sudo", "sh", "-c", command)
    else args.push("--", "bash", "-c", command)
    return args
  }

  return {
    config,

    /** Start the VM if it is not running. Idempotent. */
    async start(yamlPath) {
      const status = await attempt("limactl", ["list", "--format", "{{.Status}}", config.vm])
      const state = status.out.trim()
      if (state === "Running") return "already running"
      if (!state) {
        await run("limactl", ["start", `--name=${config.vm}`, yamlPath])
        return "created"
      }
      await run("limactl", ["start", config.vm])
      return "started"
    },

    /** Run a shell string in the guest and return its output. */
    async run(command, options = {}) {
      return run("limactl", shellArgs(command, options), options.timeout ? { timeout: options.timeout } : {})
    },

    /** Run a shell string in the guest, output going to this terminal. */
    async stream(command, options = {}) {
      return stream("limactl", shellArgs(command, options))
    },

    /**
     * Run a script in the guest, by its path under the project root. /mnt/fc is
     * this project as the guest sees it, so the guest runs exactly the file the
     * Mac just wrote.
     */
    async streamScript(path, { user = null } = {}) {
      return stream(
        "limactl",
        shellArgs(`bash ${config.workdir}/${path}`, { user }),
      )
    },

    /** A command's output, or "" if it failed. For checks. */
    async out(command, options = {}) {
      const result = await attempt("limactl", shellArgs(command, options))
      return result.ok ? result.out.trim() : ""
    },
  }
}