import { dirname, join } from 'node:path'
import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  cpSync as cp_sync,
  chmodSync as chmod_sync,
  statSync as stat_sync,
  readdirSync as readdir_sync
} from 'node:fs'

const here = dirname(Deno.execPath())
const workspace = join(here, 'realness-workspace')
const agent_dir = join(workspace, '.pi', 'agent')

const embedded = import.meta.dirname ?? here
const extracted: string[] = []
for (const part of ['skills', 'extensions', 'prompts', 'themes', 'AGENTS.md']) {
  const dest = join(workspace, part)
  const src = join(embedded, part)
  if (exists_sync(dest) || !exists_sync(src)) continue
  cp_sync(src, dest, { recursive: true })
  extracted.push(dest)
}
/** Embedded files arrive read-only; the extracted copy must be editable. */
const make_writable = (path: string) => {
  const info = stat_sync(path)
  chmod_sync(path, info.isDirectory() ? 0o755 : 0o644)
  if (info.isDirectory())
    for (const child of readdir_sync(path)) make_writable(join(path, child))
}
for (const path of extracted) make_writable(path)

mkdir_sync(agent_dir, { recursive: true })

Deno.env.set('PI_CODING_AGENT_DIR', agent_dir)
Deno.chdir(workspace)

const { main } =
  await import('npm:@earendil-works/pi-coding-agent@__PI_VERSION__')
const manage = [
  'install',
  'remove',
  'uninstall',
  'update',
  'list',
  'config',
  'auth',
  '--help',
  '-h',
  '--version',
  '-v',
  '--list-models'
]
const args = [...Deno.args]
if (
  !args.some(a => manage.includes(a)) &&
  !args.includes('--no-skills') &&
  !args.includes('--skill')
)
  args.push('--skill', join(workspace, 'skills'))

await main(args)
