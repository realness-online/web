import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { main } from '../../scripts/changelog-notes.js'
import { pick } from '../../scripts/pick-og.js'

const frontend = resolve(import.meta.dirname, '../..')
const product = resolve(import.meta.dirname, '../..')
const candidates = resolve(product, '../../artifacts/realness/og-candidates')
const og_path = join(frontend, 'public', 'og.jpg')
const scratch = resolve(
  import.meta.dirname,
  '../../../artifacts/entry-points-spec'
)

after(() => rmSync(scratch, { recursive: true, force: true }))

/** Run pick and collect what it said before it exits. */
const attempt = fn => {
  const errors = []
  const original_error = console.error
  const original_info = console.info
  const original_exit = process.exit
  const said = []
  console.error = message => errors.push(String(message))
  console.info = message => said.push(String(message))
  process.exit = () => {
    throw new Error('exit')
  }
  try {
    fn()
    return { errors, said }
  } catch {
    return { errors, said }
  } finally {
    console.error = original_error
    console.info = original_info
    process.exit = original_exit
  }
}

/** A jpeg header with a start-of-frame segment, so read_jpeg_size can read it. */
const jpeg = (width, height) => {
  const bytes = Buffer.alloc(21)
  bytes.writeUInt16BE(0xffd8, 0) // SOI
  bytes.writeUInt16BE(0xffc0, 2) // SOF0
  bytes.writeUInt16BE(17, 4) // segment length
  bytes[6] = 8 // sample precision
  bytes.writeUInt16BE(height, 7)
  bytes.writeUInt16BE(width, 9)
  return bytes
}

describe('pick-og', () => {
  it('names its usage when given no file', () => {
    const { errors } = attempt(() => pick(undefined))
    assert.match(errors.join('\n'), /usage: npm run og:pick <file>/)
  })

  it('reports a candidate that is not there, and lists what is', () => {
    mkdirSync(candidates, { recursive: true })
    writeFileSync(join(candidates, 'listed-1200x630.jpg'), jpeg(1200, 630))
    const { errors } = attempt(() => pick('not-there'))
    assert.match(errors.join('\n'), /no candidate named not-there\.jpg/)
    assert.match(errors.join('\n'), /listed-1200x630\.jpg/)
  })

  it('says to make candidates first when the folder is missing', () => {
    const saved = existsSync(candidates)
    if (saved) rmSync(candidates, { recursive: true, force: true })
    try {
      const { errors } = attempt(() => pick('anything'))
      assert.match(errors.join('\n'), /run npm run og:candidates first/)
    } finally {
      if (saved) mkdirSync(candidates, { recursive: true })
    }
  })

  it('refuses bytes that are not a readable jpeg', () => {
    mkdirSync(candidates, { recursive: true })
    writeFileSync(join(candidates, 'broken.jpg'), 'not a jpeg at all')
    const { errors } = attempt(() => pick('broken'))
    assert.match(errors.join('\n'), /broken\.jpg is not a readable jpeg/)
  })

  it('refuses a picture that is not the size the meta tags declare', () => {
    mkdirSync(candidates, { recursive: true })
    writeFileSync(join(candidates, 'small.jpg'), jpeg(600, 300))
    const { errors } = attempt(() => pick('small'))
    assert.match(errors.join('\n'), /600x300, expected 1200x630/)
  })

  it('copies the candidate it is given and names its source poster', () => {
    mkdirSync(candidates, { recursive: true })
    mkdirSync(scratch, { recursive: true })
    const destination = join(scratch, 'og.jpg')
    writeFileSync(join(candidates, 'chosen-1200x630.jpg'), jpeg(1200, 630))
    writeFileSync(
      join(candidates, 'manifest.json'),
      JSON.stringify({
        candidates: [
          {
            file: 'chosen-1200x630.jpg',
            itemid: '/+1/posters/2',
            style: 'card'
          }
        ]
      })
    )
    try {
      const { said } = attempt(() => pick('chosen-1200x630', destination))
      assert.match(
        said.join('\n'),
        /public\/og\.jpg is now chosen-1200x630\.jpg/
      )
      assert.match(said.join('\n'), /source poster \/\+1\/posters\/2 \(card\)/)
      assert.deepEqual(readFileSync(destination), jpeg(1200, 630))
    } finally {
      rmSync(join(candidates, 'chosen-1200x630.jpg'), { force: true })
      rmSync(join(candidates, 'manifest.json'), { force: true })
      rmSync(join(candidates, 'broken.jpg'), { force: true })
      rmSync(join(candidates, 'small.jpg'), { force: true })
      rmSync(join(candidates, 'listed-1200x630.jpg'), { force: true })
    }
  })

  it('accepts a name that already ends in .jpg', () => {
    mkdirSync(candidates, { recursive: true })
    writeFileSync(join(candidates, 'named-1200x630.jpg'), jpeg(1200, 630))
    try {
      mkdirSync(scratch, { recursive: true })
      const { said } = attempt(() =>
        pick('named-1200x630.jpg', join(scratch, 'og.jpg'))
      )
      assert.match(
        said.join('\n'),
        /public\/og\.jpg is now named-1200x630\.jpg/
      )
    } finally {
      rmSync(join(candidates, 'named-1200x630.jpg'), { force: true })
    }
  })
})

describe('changelog-notes', () => {
  it('answers a help request instead of writing', () => {
    const said = []
    const original = console.info
    console.info = message => said.push(String(message))
    try {
      assert.deepEqual(main(['--help']), { help: true })
    } finally {
      console.info = original
    }
    assert.match(said.join('\n'), /Usage: node scripts\/changelog-notes\.js/)
    assert.match(said.join('\n'), /--out path/)
  })

  it('writes the notes for the version it is given', () => {
    mkdirSync(scratch, { recursive: true })
    const out = join(scratch, 'notes.md')
    const version = JSON.parse(
      readFileSync(join(product, 'package.json'), 'utf8')
    ).version
    const result = main(['--version', version, '--out', out])
    assert.equal(result.out_path, out)
    assert.match(
      result.notes,
      new RegExp(`^## v${version.replace(/\./g, '\\.')}`)
    )
    assert.match(result.notes, /npm run verify/)
    assert.equal(readFileSync(out, 'utf8'), result.notes)
  })

  it('writes the notes for the package version with no arguments', () => {
    mkdirSync(scratch, { recursive: true })
    const out = join(scratch, 'default.md')
    const version = JSON.parse(
      readFileSync(join(product, 'package.json'), 'utf8')
    ).version
    const result = main(['--out', out])
    assert.match(
      result.notes,
      new RegExp(`^## v${version.replace(/\./g, '\\.')}`)
    )
  })

  it('fails loudly for a version the changelog does not have', () => {
    mkdirSync(scratch, { recursive: true })
    assert.throws(
      () => main(['--version', '0.0.1', '--out', join(scratch, 'missing.md')]),
      /No CHANGELOG\.md section for v0\.0\.1/
    )
  })
})
