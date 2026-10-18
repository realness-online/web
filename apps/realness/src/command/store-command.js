import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import {
  client,
  phone_of,
  SYNC_URL,
  SyncError
} from '#root/src/files/client.js'
import {
  login,
  person_keychain,
  token_source
} from '#root/src/sign-on/node/login.js'
import { find_root, use_harness_state } from '#root/src/harness/harness.js'
import { actor_client, actor_url } from '#root/src/harness/actor.js'
import { prepare_actor_state } from '#root/src/harness/state.js'
import { person_settings } from '#root/src/settings/environments.js'
/* eslint-disable no-await-in-loop -- removes run in the order given */

const SHOWN_DIGITS = 2

const mask = phone =>
  phone ? `${phone.slice(0, 2)}...${phone.slice(-SHOWN_DIGITS)}` : 'nobody'

/**
 * Run one signed-in store command. Returns the exit code, or null when the
 * command needs neither.
 * @returns {Promise<number | null>}
 */
const run_store_command = async (command, rest, { print, store, stdout }) => {
  if (command === 'whoami') {
    print(
      store.me
        ? `Signed in as ${mask(store.me)}`
        : 'Not signed in; run realness login'
    )
    return null
  }
  if (command === 'ls') {
    for (const name of await store.ls(rest[0] ?? 'can://~/')) print(name)
    return null
  }
  if (command === 'cat') {
    stdout.write(await store.cat(rest[0]))
    return null
  }
  if (command === 'cp') {
    print(await store.cp(rest[0], rest[1]))
    return null
  }
  if (command === 'rm') {
    for (const path of rest) await store.rm(path)
    return null
  }
  const [local, remote] = rest.filter(arg => arg !== '--deletes')
  const report = await store.sync(local, remote, {
    deletes: rest.includes('--deletes') ? 'all' : 'explained'
  })
  for (const [kind, names] of Object.entries(report)) {
    if (!Array.isArray(names) || !names.length) continue
    print(
      `${kind}: ${names.length}${['conflicts', 'kept_both', 'held'].includes(kind) ? `\n  ${names.join('\n  ')}` : ''}`
    )
  }
  return report.conflicts.length ? 1 : 0
}

/**
 * Keep the old store operations available through the single product entry.
 * @param {string[]} args
 * @param {object} [options]
 * @param {boolean} [options.actor]
 * @param {string | null} [options.root]
 * @param {() => Promise<string | null>} [options.get_token]
 * @param {string} [options.service_url]
 * @param {() => Promise<string>} [options.issue]
 * @param {NodeJS.WriteStream & { fd: 1 }} [options.stdout]
 * @param {NodeJS.WriteStream & { fd: 2 }} [options.stderr]
 */
export const run_store = async (
  args,
  {
    actor = false,
    root: root_option,
    get_token = token_source(),
    service_url,
    issue,
    stdout = process.stdout,
    stderr = process.stderr
  } = {}
) => {
  let root = root_option
  const [command, ...rest] = args
  const print = text => stdout.write(`${text}\n`)
  const sign_on = process.env.SIGN_ON_URL ?? person_settings.public_url
  if (
    !['login', 'logout', 'whoami', 'ls', 'cat', 'cp', 'rm', 'sync'].includes(
      command
    )
  ) {
    stderr.write(
      'usage: realness login|logout|whoami|ls|cat|cp|rm|store sync ...\n'
    )
    return 2
  }
  try {
    if (actor && ['login', 'logout'].includes(command))
      throw new Error('actors use halo-issued passes')
    if (command === 'login') {
      print(
        `Opening ${sign_on}/sign-on in your browser. Click to sign Realness in.`
      )
      const { id_token } = await login({
        sign_on,
        open: url => promisify(exec_file)('open', [url])
      })
      print(`Signed in as ${mask(phone_of(id_token))}. The keychain holds it.`)
      return 0
    }
    if (command === 'logout') {
      await person_keychain.remove()
      print('Signed out; the keychain entry is gone.')
      return 0
    }
    if (!actor)
      try {
        root ??= find_root()
      } catch {
        root = null
      }

    let store
    if (actor) {
      const actor_root = root ?? '/realness'
      const actor_state = await prepare_actor_state(actor_root)
      ;({ store } = await actor_client({
        url: service_url ?? (await actor_url(actor_root, actor_state)),
        state: actor_state,
        issue
      }))
    } else {
      const token = await get_token()
      store = client({
        url: service_url ?? SYNC_URL,
        token,
        state: root ? use_harness_state(root) : undefined
      })
    }
    return (
      (await run_store_command(command, rest, { print, store, stdout })) ?? 0
    )
  } catch (error) {
    const hints = {
      401: 'sign in again: TOKEN is missing, expired, or from another project',
      403: 'not yours to touch',
      404: 'not found'
    }
    stderr.write(
      `${
        error instanceof SyncError
          ? `${error.message}${hints[error.status] ? ` - ${hints[error.status]}` : ''}`
          : error.message
      }\n`
    )
    return 1
  }
}
