#!/usr/bin/env node
/**
 * realness-models
 *
 * Puts the system's `realness` provider into the person's Pi models before Pi
 * starts. The person's other providers stay. A default that names a realness
 * model the system no longer has moves to the starter's default.
 *
 *     /usr/local/share/realness-starter/.pi/agent   the system's copy
 *     /realness/.pi/agent                           the person's copy
 */
import {
  chownSync as chown_sync,
  existsSync as exists_sync,
  readFileSync as read_file_sync,
  renameSync as rename_sync,
  statSync as stat_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, join } from 'node:path'

const starter =
  process.env.REALNESS_STARTER_AGENT ??
  '/usr/local/share/realness-starter/.pi/agent'
const home = process.env.REALNESS_AGENT ?? '/realness/.pi/agent'

const read = path =>
  exists_sync(path) ? JSON.parse(read_file_sync(path, 'utf8')) : {}

const write = (path, value) => {
  const owner = stat_sync(exists_sync(path) ? path : dirname(path))
  const next = `${path}.next`
  write_file_sync(next, `${JSON.stringify(value, null, 2)}\n`)
  chown_sync(next, owner.uid, owner.gid)
  rename_sync(next, path)
}

const provider = read(join(starter, 'models.json')).providers.realness
const models = read(join(home, 'models.json'))
write(join(home, 'models.json'), {
  ...models,
  providers: { ...models.providers, realness: provider }
})

const ids = provider.models.map(model => model.id)
const known = name =>
  !name.startsWith('realness/') || ids.includes(name.slice('realness/'.length))
const settings = read(join(home, 'settings.json'))
const next = { ...settings }
if (
  settings.defaultProvider === 'realness' &&
  !ids.includes(settings.defaultModel)
)
  next.defaultModel = read(join(starter, 'settings.json')).defaultModel
if (settings.enabledModels)
  next.enabledModels = settings.enabledModels.filter(known)
if (JSON.stringify(next) !== JSON.stringify(settings))
  write(join(home, 'settings.json'), next)
