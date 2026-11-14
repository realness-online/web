import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import { jar_page } from '#root/src/halo/cookie-jar.js'
import {
  find_scout_code,
  run_scout_code,
  scout_codes,
  scout_read,
  box_cookies
} from '../../server/halo/guest/realness-scout.js'

const FENCE = '```'
const code = `export const read = async (url, { cookies, fetcher, brief }) => {
  const reply = await fetcher(url, { headers: { cookie: cookies.map(c => c.name + '=' + c.value).join('; ') } })
  return { status: reply.status, html: (brief ? 'brief ' : '') + (await reply.text()) }
}
`
const sources = `# Sources

## 1. Example

${FENCE}js scout example www.example.com
${code}${FENCE}

## 2. Plain

${FENCE}js
not scout code
${FENCE}
`

const fetcher = async (url, options) => ({
  status: 200,
  text: async () => `${url} ${options.headers.cookie}`
})

/** A vault with one plan whose Sources.md holds the given text. */
const vault_of = (t, text = sources) => {
  mkdirSync(out_path(), { recursive: true })
  const root = mkdtempSync(out_path('guest-scout-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'Projects', 'plan', 'Runs'), { recursive: true })
  writeFileSync(join(root, 'Projects', 'plan', 'Sources.md'), text)
  return root
}

it('scout code is a js scout fence; other fences are not', () => {
  assert.deepEqual(scout_codes(sources), [
    { site: 'example', host: 'www.example.com', code }
  ])
})

it('scout code is found by site, or by host when no site is named', t => {
  const root = vault_of(t)
  assert.equal(
    find_scout_code({ site: 'example', host: 'x' }, root)?.site,
    'example'
  )
  assert.equal(
    find_scout_code({ host: 'www.example.com' }, root)?.site,
    'example'
  )
  assert.equal(find_scout_code({ host: 'other.com' }, root), null)
  assert.equal(find_scout_code({ host: 'x' }, join(root, 'missing')), null)
})

it('scout code runs as a module with the cookies it is given', async () => {
  const page = await run_scout_code(
    { site: 'example', host: 'www.example.com', code },
    'https://www.example.com/',
    {
      cookies: [{ name: 'a', value: 'b' }],
      fetcher,
      brief: true
    }
  )
  assert.deepEqual(page, {
    status: 200,
    html: 'brief https://www.example.com/ a=b'
  })
})

it('a scout read takes the site login from the door', async () => {
  const asked = []
  const ask = async request => {
    asked.push(request)
    return { ok: true, cookies: [{ name: 'from', value: 'the-door' }] }
  }
  const page = await scout_read(
    { site: 'example', host: 'www.example.com', code },
    'https://www.example.com/',
    { ask, fetcher }
  )
  assert.equal(page.html, 'https://www.example.com/ from=the-door')
  assert.deepEqual(asked, [{ op: 'site-cookies', site: 'example' }])
})

it('a scout read with no saved login says so before it reads', async () => {
  await assert.rejects(
    scout_read({ site: 'example', host: 'h', code }, 'https://h/', {
      ask: async () => ({ ok: true, cookies: [] }),
      fetcher
    }),
    /no saved example login/
  )
})

it('a box with a saved login reads with it, and borrows no Chrome', async () => {
  const asked = []
  const page = await scout_read(
    { site: 'example', host: 'www.example.com', code },
    'https://www.example.com/',
    {
      ask: async request => {
        asked.push(request)
        return { ok: true }
      },
      fetcher,
      saved: [{ name: 'jar', value: 'yes' }]
    }
  )
  assert.equal(page.html, 'https://www.example.com/ jar=yes')
  assert.deepEqual(asked, [])
})

it("a box's jar page gives its cookies back, escapes undone", t => {
  const root = mkdtempSync(join(tmpdir(), 'box-jars-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, '+14155550123'))
  writeFileSync(
    join(root, '+14155550123', 'yc.html'),
    jar_page('yc', [
      {
        name: '_sso.key',
        value: 'a&b',
        domain: '.x.com',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: true
      }
    ])
  )
  assert.deepEqual(box_cookies('yc', root), [
    { name: '_sso.key', value: 'a&b' }
  ])
  assert.equal(box_cookies('swooped', root), null)
})
