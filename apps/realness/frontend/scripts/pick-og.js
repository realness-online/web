import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { artifacts_dir } from './lib/artifacts.js'
import { read_jpeg_size } from './lib/jpeg-size.js'

const __dirname = path.dirname(file_url_to_path(import.meta.url))
const project_root = path.join(__dirname, '..')
const candidates_dir = path.join(artifacts_dir, 'og-candidates')
const og_path = path.join(project_root, 'public', 'og.jpg')

const OG_WIDTH = 1200
const OG_HEIGHT = 630

export const fail = message => {
  console.error(`pick-og: ${message}`)
  process.exit(1)
}

export const pick = (requested, destination = og_path) => {
  if (!requested)
    fail('usage: npm run og:pick <file> (see artifacts/brayness/og-candidates)')

  const file = requested.endsWith('.jpg') ? requested : `${requested}.jpg`
  const source = path.join(candidates_dir, file)

  if (!fs.existsSync(source)) {
    const available = fs.existsSync(candidates_dir)
      ? fs
          .readdirSync(candidates_dir)
          .filter(name => name.endsWith('.jpg'))
          .join('\n  ')
      : 'none - run npm run og:candidates first'
    fail(`no candidate named ${file}\n  ${available}`)
  }

  const size = read_jpeg_size(fs.readFileSync(source))
  if (!size) fail(`${file} is not a readable jpeg`)
  if (size.width !== OG_WIDTH || size.height !== OG_HEIGHT)
    fail(
      `${file} is ${size.width}x${size.height}, expected ${OG_WIDTH}x${OG_HEIGHT} - the meta tags declare those dimensions`
    )

  fs.copyFileSync(source, destination)

  const manifest_path = path.join(candidates_dir, 'manifest.json')
  const manifest = fs.existsSync(manifest_path)
    ? JSON.parse(fs.readFileSync(manifest_path, 'utf8'))
    : null
  const entry = manifest?.candidates?.find(candidate => candidate.file === file)

  console.info(`pick-og: public/og.jpg is now ${file}`)
  if (entry)
    console.info(`pick-og: source poster ${entry.itemid} (${entry.style})`)
  console.info('pick-og: commit public/og.jpg, then npm run deploy')

}

if (process.argv[1] === file_url_to_path(import.meta.url)) pick(process.argv[2])
