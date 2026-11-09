#!/usr/bin/env node
/**
 * Mail the scouts' runs that have not been mailed yet, as one digest.
 *
 *     node scripts/mail-digest.js          print the digest, stamp nothing
 *     node scripts/mail-digest.js --send   mail it through Apple Mail
 *
 * Apple Mail runs on this Mac, not in the halo, so the digest is read from the
 * shared vault here. A run is stamped `mailed` only after Mail accepts it.
 */
import { execFile as exec_file } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { promisify } from 'node:util'
import { DIGEST_TO, digest_of, mail_digest } from '#root/src/scouts/mail.js'
import { run_entry } from './lib/entry.js'

const run = promisify(exec_file)
const here = resolve(dirname(file_url_to_path(import.meta.url)), '../../..')
const vault_dir = resolve(here, 'vault')

/** Apple Mail on the Mac, one message to Scott, sent rather than left open. */
const SCRIPT = `on run argv
  set theSubject to item 1 of argv
  set theBody to item 2 of argv
  tell application "Mail"
    set theMessage to make new outgoing message with properties {subject:theSubject, content:theBody, visible:false}
    tell theMessage
      make new to recipient at end of to recipients with properties {address:"${DIGEST_TO}"}
    end tell
    send theMessage
  end tell
end run`

/**
 * Hand the digest to Apple Mail. A Mac is the only machine with Mail.
 * @param {string} subject
 * @param {string} body
 */
export const send_mail = async (subject, body) => {
  if (process.platform !== 'darwin')
    throw new Error('the digest needs Apple Mail, which runs on a Mac')
  await run('osascript', ['-e', SCRIPT, subject, body])
}

/**
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {string} [options.vault]
 * @param {(subject: string, body: string) => Promise<void>} [options.send]
 * @param {() => number} [options.clock]
 * @param {{ write: (line: string) => void }} [options.out]
 * @param {{ write: (line: string) => void }} [options.err]
 */
export const main = async ({
  args = process.argv.slice(2),
  vault = vault_dir,
  send = send_mail,
  clock = Date.now,
  out = process.stdout,
  err = process.stderr
} = {}) => {
  const now = clock()
  if (!args.includes('--send')) {
    const { count, subject, body } = await digest_of({ vault_dir: vault, now })
    out.write(count ? `${subject}\n\n${body}\n` : 'nothing to mail\n')
    return count
  }
  const count = await mail_digest({ vault_dir: vault, send, now }).catch(
    error => {
      err.write(`${error.message}\n`)
      process.exitCode = 1
      return 0
    }
  )
  if (count) out.write(`mailed ${count}\n`)
  return count
}

await run_entry(import.meta.url, main)
