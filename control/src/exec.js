/**
 * Run a program and return its output, or throw with what it said.
 *
 * Everything in the control plane is a call to something else - `gcloud`,
 * `limactl`, `bash`. argv arrays rather than a shell string, so a hostname or a
 * path with a space cannot turn into two arguments, and no quoting bug is
 * possible. Node runs on this Mac only; the guest and host steps are bash.
 */
import { execFile } from "node:child_process"

/** Collect output; never let a stream go to the terminal unnoticed. */
function capture(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { maxBuffer: 32 * 1024 * 1024, ...options },
      (error, stdout, stderr) => {
        if (!error) return resolve({ stdout, stderr, code: 0 })
        // The exit code is the useful part of a failure; the message is often
        // just "Command failed".
        error.stdout = stdout
        error.stderr = stderr
        error.code = typeof error.code === "number" ? error.code : 1
        reject(error)
      },
    )
  })
}

/** Run a command and throw if it fails. Returns stdout. */
export async function run(command, args = [], options = {}) {
  const { stdout } = await capture(command, args, options)
  return stdout
}

/** Run a command and return everything, including on failure. */
export async function attempt(command, args = [], options = {}) {
  try {
    const { stdout, stderr, code } = await capture(command, args, options)
    return { ok: true, out: stdout, err: stderr, code }
  } catch (error) {
    return {
      ok: false,
      out: error.stdout ?? "",
      err: error.stderr ?? error.message,
      code: error.code,
    }
  }
}

/**
 * Run a command with its output going straight to this terminal.
 *
 * For anything slow: a template build, a host bootstrap. The output is the
 * progress report, and capturing it would mean showing nothing for minutes.
 */
export function stream(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { ...options }, (error) => {
      if (!error) return resolve()
      error.code = typeof error.code === "number" ? error.code : 1
      reject(error)
    })
    child.stdout?.pipe(process.stdout)
    child.stderr?.pipe(process.stderr)
  })
}

/** Print a step heading. Every multi-step command announces each step. */
export function step(text) {
  process.stdout.write(`\n==> ${text}\n`)
}

/** Print a fact under the current step. */
export function note(text) {
  process.stdout.write(`    ${text}\n`)
}