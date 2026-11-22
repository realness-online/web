import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { cookie_jars } from '#root/src/halo/cookie-jar.js'
import { main, under } from '#root/scripts/cookie-import.js'

const cookie = (name, domain) => ({
  name,
  value: 'v',
  domain,
  path: '/',
  expires: -1,
  httpOnly: true,
  secure: true
})

/** A stand-in stdout that keeps what a command printed. */
const lines = () => {
  const written = []
  return { written, write: line => written.push(line) }
}

describe('cookie import', () => {
  it('a cookie belongs to its domain and the hosts below it, nothing else', () => {
    expect(under('www.workatastartup.com', 'workatastartup.com')).toBe(true)
    expect(under('.workatastartup.com', 'workatastartup.com')).toBe(true)
    expect(under('notworkatastartup.com', 'workatastartup.com')).toBe(false)
    expect(under('news.ycombinator.com', 'workatastartup.com')).toBe(false)
  })

  it("reads only the site's cookies from a Chrome", async () => {
    const root = await mkdtemp(join(tmpdir(), 'cookie-import-'))
    const json = join(root, 'cookies.json')
    const cookies = {
      get: async () => [
        cookie('_sso.key', '.workatastartup.com'),
        cookie('user', 'news.ycombinator.com')
      ],
      set: async () => {}
    }
    await main({
      args: [
        '--from',
        'http://127.0.0.1:9333',
        '--domain',
        'workatastartup.com',
        '--json',
        json
      ],
      cookies,
      out: lines()
    })
    const saved = JSON.parse(await readFile(json, 'utf8'))
    expect(saved.map(found => found.name)).toEqual(['_sso.key'])
    await rm(root, { recursive: true })
  })

  it('refuses to save an empty read, so a logged-out browser keeps no jar', async () => {
    await expect(
      main({
        args: [
          '--from',
          'http://127.0.0.1:9333',
          '--domain',
          'workatastartup.com'
        ],
        cookies: { get: async () => [], set: async () => {} },
        out: lines()
      })
    ).rejects.toThrow(/no cookies for workatastartup.com/)
  })

  it('writes the cookies into the owner jar, readable by the halo alone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cookie-import-'))
    const json = join(root, 'cookies.json')
    await writeFile(
      json,
      JSON.stringify([cookie('_sso.key', '.workatastartup.com')])
    )
    const jars = join(root, 'jars')
    await main({
      args: [
        '--json',
        json,
        '--owner',
        '+14155550123',
        '--site',
        'yc',
        '--root',
        jars
      ],
      out: lines()
    })
    const loaded = await cookie_jars(jars).load('+14155550123', 'yc')
    expect(loaded.map(found => found.name)).toEqual(['_sso.key'])
    expect((await stat(join(jars, '+14155550123/yc.html'))).mode & 0o777).toBe(
      0o600
    )
    await rm(root, { recursive: true })
  })

  it('a jar write needs all four flags', async () => {
    await expect(
      main({ args: ['--json', 'x.json'], out: lines() })
    ).rejects.toThrow(/--json, --owner, --site, --root/)
  })
})
