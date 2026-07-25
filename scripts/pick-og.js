import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { read_jpeg_size } from './lib/jpeg-size.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const project_root = path.join(__dirname, '..')
const candidates_dir = path.join(project_root, 'artifacts', 'og-candidates')
const og_path = path.join(project_root, 'public', 'og.jpg')

const OG_WIDTH = 1200
const OG_HEIGHT = 630

const fail = message => {
  console.error(`pick-og: ${message}`)
  process.exit(1)
}

const [, , requested] = process.argv
if (!requested)
  fail('usage: npm run og:pick <file> (see artifacts/og-candidates)')

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

fs.copyFileSync(source, og_path)

const manifest_path = path.join(candidates_dir, 'manifest.json')
const manifest = fs.existsSync(manifest_path)
  ? JSON.parse(fs.readFileSync(manifest_path, 'utf8'))
  : null
const entry = manifest?.candidates?.find(candidate => candidate.file === file)

console.info(`pick-og: public/og.jpg is now ${file}`)
if (entry)
  console.info(`pick-og: source poster ${entry.itemid} (${entry.style})`)
console.info('pick-og: commit public/og.jpg, then npm run deploy')
