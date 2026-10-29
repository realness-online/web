/**
 * vlt1: `realness vault search <words> [--limit N] [--json]` and
 * `realness vault note <path> [--json]`. Inside an actor the vault stays on
 * the Mac; this asks the Mac's sync, with the actor's own harness pass.
 */
import { actor_url } from '#root/src/harness/actor.js'
import { door_pass } from '#root/src/harness/recover.js'
import { LIMIT_DEFAULT } from '#root/src/sync/vault.js'
import { HTTP } from '#root/lib/http.js'

const USAGE = 'usage: realness vault search <words> [--limit N] | note <path>'

/**
 * @param {string[]} args
 * @param {{ stdout?: NodeJS.WritableStream, fetcher?: typeof fetch, url?: () => Promise<string>, issue?: () => Promise<string> }} [options]
 */
export const run_vault = async (
  args,
  {
    stdout = process.stdout,
    fetcher = fetch,
    url = () => actor_url(),
    issue = () => door_pass('harness-pass')
  } = {}
) => {
  const json = args.includes('--json')
  const limit_at = args.indexOf('--limit')
  const limit = limit_at === -1 ? LIMIT_DEFAULT : Number(args[limit_at + 1])
  const words = args.filter(
    (arg, i) => arg !== '--json' && i !== limit_at && i !== limit_at + 1
  )
  const [verb, ...rest] = words
  const text = rest.join(' ').trim()
  if (!['search', 'note'].includes(verb) || !text) throw new Error(USAGE)
  const address = new URL(
    verb === 'search' ? 'v1/vault/search' : 'v1/vault/note',
    `${(await url()).replace(/\/$/, '')}/`
  )
  if (verb === 'search') {
    address.searchParams.set('q', text)
    address.searchParams.set('limit', String(limit))
  } else address.searchParams.set('path', text)
  const response = await fetcher(address, {
    headers: { authorization: `Bearer ${await issue()}` }
  })
  if (response.status === HTTP.NOT_FOUND)
    throw new Error(
      verb === 'note' ? `no note at ${text}` : 'this sync has no vault'
    )
  if (!response.ok) throw new Error(`vault ${verb}: HTTP ${response.status}`)
  const body = await response.json()
  if (json) stdout.write(`${JSON.stringify(body)}\n`)
  else if (verb === 'note') stdout.write(body.text)
  else
    stdout.write(
      body.notes.map(note => `${note.path}\n  ${note.text}\n`).join('') ||
        'no notes match\n'
    )
  return 0
}
