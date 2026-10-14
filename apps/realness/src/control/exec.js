/**
 * Run a program and return its output, or throw with what it said.
 *
 * Everything in the control plane is a call to something else - `gcloud`,
 * `limactl`, `bash`. argv arrays rather than a shell string, so a hostname or a
 * path with a space cannot turn into two arguments, and no quoting bug is
 * possible. Node runs on this Mac only; the guest and host steps are bash.
 */
import { execFile as exec_file } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import { progress } from './output.js'
import { MIB } from '#root/lib/units.js'

const OUTPUT_MIB = 32

/** Collect output; never let a stream go to the terminal unnoticed. */
const capture = (command, args, options) =>
  new Promise((resolve, reject) => {
    exec_file(
      command,
      args,
      { maxBuffer: OUTPUT_MIB * MIB, ...options },
      (error, stdout, stderr) => {
        if (!error) return resolve({ stdout, stderr, code: 0 })
        error.stdout = stdout
        error.stderr = stderr
        error.code = typeof error.code === 'number' ? error.code : 1
        reject(error)
      }
    )
  })

/** Run a command and throw if it fails. Returns stdout. */
export const run = async (command, args = [], options = {}) => {
  const { stdout } = await capture(command, args, options)
  return stdout
}

/** Run a command and return everything, including on failure. */
export const attempt = async (command, args = [], options = {}) => {
  try {
    const { stdout, stderr, code } = await capture(command, args, options)
    return { ok: true, out: stdout, err: stderr, code }
  } catch (error) {
    return {
      ok: false,
      out: error.stdout ?? '',
      err: error.stderr ?? error.message,
      code: error.code
    }
  }
}

/**
 * Run a command with its output going straight to this terminal.
 *
 * For anything slow: a template build, a host bootstrap. The output is the
 * progress report, and capturing it would mean showing nothing for minutes.
 */
export const stream = (command, args = [], options = {}) =>
  new Promise((resolve, reject) => {
    const child = exec_file(command, args, { ...options }, error => {
      if (!error) return resolve()
      error.code = typeof error.code === 'number' ? error.code : 1
      reject(error)
    })
    for (const source of [child.stdout, child.stderr]) {
      const decoder = new StringDecoder('utf8')
      let pending = ''
      source?.on('data', chunk => {
        pending += decoder.write(chunk)
        const end = pending.lastIndexOf('\n')
        if (end < 0) return
        progress(pending.slice(0, end + 1))
        pending = pending.slice(end + 1)
      })
      source?.on('end', () => progress(pending + decoder.end()))
    }
  })

/** Print a step heading. Every multi-step command announces each step. */
export const step = text => {
  progress(`\n==> ${text}\n`)
}

/** Print a fact under the current step. */
export const note = text => {
  progress(`    ${text}\n`)
}
