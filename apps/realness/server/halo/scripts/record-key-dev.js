import { randomBytes as random_bytes } from 'node:crypto'
import {
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync,
  chmodSync as chmod_sync,
  existsSync as exists_sync
} from 'node:fs'
import { hostname } from 'node:os'
import { disk } from '#root/src/can/disk.js'

const path = '/etc/realness/record-secret'
const name = hostname()
mkdir_sync('/etc/realness', { recursive: true, mode: 0o700 })
if (!exists_sync(path))
  write_file_sync(path, random_bytes(32).toString('hex'), {
    mode: 0o600,
    flag: 'wx'
  })
chmod_sync(path, 0o600)
const key = read_file_sync(path, 'utf8').trim()
const storage = disk(process.env.SYNC_DIR)
await storage.put(`halo-keys/${name}`, key)
if (!(await storage.get('admins.html')))
  await storage.put(
    'admins.html',
    '<a href="tel:+14156667777">Dev operator</a>'
  )
