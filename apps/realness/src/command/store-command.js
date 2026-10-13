import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { client, phone_of, SYNC_URL, SyncError } from '#root/src/files/client.js'
import { keychain, login, token_source } from '#root/src/sign-on/node/login.js'
import { find_root, use_harness_state } from '#root/src/harness/harness.js'
import { actor_client, actor_url } from '#root/src/harness/actor.js'
import { prepare_actor_state } from '#root/src/harness/state.js'
import { development_settings } from '#root/src/settings/environments.js'

const mask = phone => phone ? `${phone.slice(0, 2)}...${phone.slice(-2)}` : 'nobody'

/** Keep the old store operations available through the single product entry. */
export const run_store = async (args, {
  actor = false, root, get_token = token_source(), service_url,
  issue, stdout = process.stdout, stderr = process.stderr
} = {}) => {
  const [command, ...rest] = args
  const print = text => stdout.write(text + '\n')
  const sign_on = process.env.SIGN_ON_URL ?? development_settings.public_url
  if (!['login', 'logout', 'whoami', 'ls', 'cat', 'cp', 'rm', 'sync'].includes(command)) {
    stderr.write('usage: realness login|logout|whoami|ls|cat|cp|rm|store sync ...\n')
    return 2
  }
  try {
    if (actor && ['login', 'logout'].includes(command)) throw new Error('actors use host-issued passes')
    if (command === 'login') {
      print(`Opening ${sign_on}/sign-on in your browser. Click to sign Realness in.`)
      const { id_token } = await login({ sign_on, open: url => promisify(exec_file)('open', [url]) })
      print(`Signed in as ${mask(phone_of(id_token))}. The keychain holds it.`)
      return 0
    }
    if (command === 'logout') {
      await keychain.remove()
      print('Signed out; the keychain entry is gone.')
      return 0
    }
    if (!actor) {
      try { root ??= find_root() } catch { root = null }
      if (root) use_harness_state(root)
    }
    if (actor) {
      root ??= process.env.BRAYNESS_ROOT ?? '/brayness'
      process.env.BRAYNESS_STATE = await prepare_actor_state(root)
    }
    const token = actor ? null : await get_token()
    const store = actor
      ? (await actor_client({ url: service_url ?? await actor_url(root), issue })).store
      : client({ url: service_url ?? SYNC_URL, token })
    if (command === 'whoami') print(store.me ? `Signed in as ${mask(store.me)}` : 'Not signed in; run realness login')
    else if (command === 'ls') for (const name of await store.ls(rest[0] ?? 'can://~/')) print(name)
    else if (command === 'cat') stdout.write(await store.cat(rest[0]))
    else if (command === 'cp') print(await store.cp(rest[0], rest[1]))
    else if (command === 'rm') for (const path of rest) await store.rm(path)
    else if (command === 'sync') {
      const [local, remote] = rest.filter(arg => arg !== '--deletes')
      const report = await store.sync(local, remote, { deletes: rest.includes('--deletes') ? 'all' : 'explained' })
      for (const [kind, names] of Object.entries(report)) {
        if (!Array.isArray(names) || !names.length) continue
        print(`${kind}: ${names.length}${['conflicts', 'kept_both', 'held'].includes(kind) ? `\n  ${names.join('\n  ')}` : ''}`)
      }
      return report.conflicts.length ? 1 : 0
    }
    return 0
  } catch (error) {
    const hints = { 401: 'sign in again: TOKEN is missing, expired, or from another project', 403: 'not yours to touch', 404: 'not found' }
    stderr.write((error instanceof SyncError ? `${error.message}${hints[error.status] ? ` - ${hints[error.status]}` : ''}` : error.message) + '\n')
    return 1
  }
}
