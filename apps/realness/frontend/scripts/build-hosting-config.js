import {
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { resolve } from 'node:path'
import { product_paths } from '#root/src/settings/layout.js'
import { frontend_out, out_path } from '#root/src/settings/output.js'

const { frontend } = product_paths()
const config = JSON.parse(
  read_file_sync(resolve(frontend, 'firebase.json'), 'utf8')
)
for (const hosting of config.hosting)
  hosting.public =
    hosting.target === 'app'
      ? frontend_out()
      : resolve(frontend, hosting.public)
config.storage.rules = resolve(frontend, config.storage.rules)
mkdir_sync(out_path('frontend'), { recursive: true })
write_file_sync(
  out_path('frontend', 'firebase.json'),
  `${JSON.stringify(config, null, 2)}\n`
)
write_file_sync(
  out_path('frontend', '.firebaserc'),
  read_file_sync(resolve(frontend, '.firebaserc'))
)
