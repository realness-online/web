import { existsSync } from 'node:fs'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { item_html } from '#root/lib/items.js'
import { scout_page } from '#root/src/scouts/scout.js'
import {
  at_most,
  local_pi,
  main,
  read_outside,
  reads_inside
} from '#root/scripts/scout.js'

const SCOUTS = 'vault/Projects/Scouts'

/** One plan folder with a scout page, and a profile and sources beside it. */
const plan = async (root, name, fields = {}) => {
  const folder = join(root, SCOUTS, name)
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'scout.html'),
    scout_page(name, {
      itemid: `/+1/scouts/${name.toLowerCase()}`,
      org: '+1',
      schedule: 'a few times a day',
      minutes: 30,
      per_day: 4,
      status: 'active',
      ...fields
    })
  )
  await writeFile(join(folder, 'Profile.md'), `# ${name} profile\n`)
  await writeFile(join(folder, 'Sources.md'), `# ${name} sources\n`)
  return folder
}

const scratch = async (names = ['Realness']) => {
  const root = await mkdtemp(join(tmpdir(), 'scout-script-'))
  for (const name of names) await plan(root, name)
  return { root, vault: join(root, 'vault') }
}

/** A stand-in stdout or stderr that keeps what a command printed. */
const lines = () => {
  const written = []
  return { written, write: line => written.push(line) }
}

describe('scout script', () => {
  it('prints the brief for every active scout, and nothing for a paused one', async () => {
    const { root, vault } = await scratch(['Realness', 'SMS'])
    await plan(root, 'SMS', { status: 'paused' })
    const out = lines()
    await main({ args: ['--dry-run'], vault, out })
    expect(out.written.length).toBe(1)
    expect(out.written[0]).toMatch(/# Realness profile/)
    expect(out.written[0]).toMatch(/# Realness sources/)
    await rm(root, { recursive: true })
  })

  it('runs the one scout it is named after, by its folder name', async () => {
    const { root, vault } = await scratch(['Realness', 'SMS'])
    const out = lines()
    await main({ args: ['sms', '--dry-run'], vault, out })
    expect(out.written.length).toBe(1)
    expect(out.written[0]).toMatch(/# SMS profile/)
    await rm(root, { recursive: true })
  })

  it('names the scouts a vault holds when the name is not one of them', async () => {
    const { root, vault } = await scratch()
    await expect(
      main({ args: ['Nope', '--dry-run'], vault, out: lines() })
    ).rejects.toThrow(/no scout named Nope: try Scouts\/Realness/)
    await rm(root, { recursive: true })
  })

  it('a scout page holding no /scout item says which file it is', async () => {
    const { root, vault } = await scratch()
    await writeFile(
      join(root, SCOUTS, 'Realness/scout.html'),
      '<!doctype html><title>empty</title>'
    )
    await expect(main({ vault, out: lines() })).rejects.toThrow(
      /scout\.html holds no \/scout item/
    )
    await rm(root, { recursive: true })
  })

  it('says what to write when the vault holds no active scout', async () => {
    const { root, vault } = await scratch()
    await plan(root, 'Realness', { status: 'paused' })
    await expect(main({ vault, out: lines() })).rejects.toThrow(
      /no active scout/
    )
    await rm(root, { recursive: true })
  })

  it('writes nothing into the vault, even with no --dry-run given', async () => {
    const { root, vault } = await scratch()
    const out = lines()
    await main({ args: ['Realness'], vault, out })
    expect(out.written.length).toBe(1)
    const folder = join(root, SCOUTS, 'Realness')
    expect(existsSync(join(folder, 'Runs'))).toBe(false)
    expect(existsSync(join(folder, 'Leads'))).toBe(false)
    expect(existsSync(join(folder, 'Finds'))).toBe(false)
    await rm(root, { recursive: true })
  })

  it('refuses a name two scouts share, naming both', async () => {
    const { root, vault } = await scratch()
    await plan(root, 'Bedroom/Realness')
    await expect(
      main({ args: ['Realness', '--dry-run'], vault, out: lines() })
    ).rejects.toThrow(
      /two scouts are named Realness: Scouts\/Bedroom\/Realness, Scouts\/Realness/
    )
    await rm(root, { recursive: true })
  })
})

describe('scout --run', () => {
  it('starts every source at once, and one failure leaves the others', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scout-run-all-'))
    const folder = join(root, 'vault/Projects/leads')
    await mkdir(folder, { recursive: true })
    await writeFile(
      join(folder, 'scout.html'),
      scout_page('leads', {
        itemid: '/+1/scouts/leads',
        org: '+1',
        schedule: 'daily',
        minutes: 1,
        per_day: 1,
        status: 'active'
      })
    )
    await writeFile(join(folder, 'Profile.md'), '# profile\n')
    await writeFile(
      join(folder, 'Sources.md'),
      '# sources\n\n## 1. Alpha\n\nread a https://a.test/\n\n## 2. Beta\n\nread b https://b.test/\n\n## 3. Gamma\n\nread c https://c.test/\n'
    )
    await writeFile(
      join(root, 'package.json'),
      '{"realness":{"person":"+14155550123"}}'
    )
    let running = 0
    let peak = 0
    let all_started
    const together = new Promise(done => (all_started = done))
    const spawn_pi = async (brief, run_dir) => {
      running += 1
      peak = Math.max(peak, running)
      if (running === 3) all_started()
      await together
      running -= 1
      if (/read b/.test(brief)) return 1
      await writeFile(
        join(run_dir, 'finds.html'),
        item_html(
          'find',
          {
            url: `https://example.com/${run_dir.length}`,
            title: 'A',
            org: 'Acme',
            source: 'x',
            score: '7',
            reason: 'fits'
          },
          { links: ['url'] }
        )
      )
      return 0
    }
    const out = lines()
    const rows = await main({
      args: ['leads', '--run'],
      vault: join(root, 'vault'),
      out,
      err: lines(),
      spawn_pi,
      ready: async () => 'mac'
    })
    expect(peak).toBe(3)
    expect(rows).toHaveLength(3)
    expect(rows.filter(row => /1 leads/.test(row))).toHaveLength(2)
    expect(rows.filter(row => /failed/.test(row))).toHaveLength(1)
    await rm(root, { recursive: true })
  })

  it('a box the halo has not readied starts no pi and says why', async () => {
    let spawned = 0
    const err = lines()
    const rows = await main({
      args: ['--run'],
      vault: '/nowhere',
      out: lines(),
      err,
      spawn_pi: async () => (spawned += 1),
      ready: async () => {
        throw new Error('the halo issued no model pass: door closed')
      }
    })
    expect(rows).toEqual([])
    expect(spawned).toBe(0)
    expect(err.written.join('')).toMatch(
      /not ready: the halo issued no model pass/
    )
    process.exitCode = 0
  })
})

describe('at most', () => {
  it('never runs more than the limit, and runs every job', async () => {
    let running = 0
    let peak = 0
    const done = await at_most([1, 2, 3, 4, 5, 6, 7], 3, async n => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise(resolve => setTimeout(resolve, 5))
      running -= 1
      return n * 2
    })
    expect(peak).toBe(3)
    expect(done).toEqual([2, 4, 6, 8, 10, 12, 14])
  })
})

/** A pi stand-in: prints the given event lines, then waits forever. */
const fake_pi = async (dir, events) => {
  const bin = join(dir, 'fake-pi.js')
  await writeFile(
    bin,
    `#!/usr/bin/env node\nfor (const line of ${JSON.stringify(events.map(event => JSON.stringify(event)))}) console.log(line)\nsetInterval(() => {}, 1 << 30)\n`
  )
  await chmod(bin, 0o755)
  return bin
}

const start = (id, args) => ({
  type: 'tool_execution_start',
  toolCallId: id,
  toolName: 'bash',
  args
})
const end = (id, name, text, args) => ({
  type: 'tool_execution_end',
  toolCallId: id,
  toolName: name,
  ...(args ? { args } : {}),
  result: { content: [{ type: 'text', text }] }
})

describe('the pages a run may read', () => {
  it('is the source URL and the pages under it', () => {
    const allowed = ['https://board.test/jobs', 'https://api.test/search']
    expect(read_outside('curl https://board.test/jobs', allowed)).toBe('')
    expect(read_outside('curl https://board.test/jobs?page=2', allowed)).toBe(
      ''
    )
    expect(
      read_outside('curl https://board.test/jobs/acme-engineer', allowed)
    ).toBe('')
    expect(read_outside('curl https://api.test/search?q=rust', allowed)).toBe(
      ''
    )
    expect(read_outside('curl https://api.test/search.', allowed)).toBe('')
    expect(read_outside('ls /vault', allowed)).toBe('')
  })

  it('a page beside the source, or a listing next to another, is outside', () => {
    expect(
      read_outside('curl https://board.test/other/jobs', [
        'https://board.test/jobs'
      ])
    ).toBe('https://board.test/other/jobs')
    expect(
      reads_inside('https://api.test/listing-2', 'https://api.test/list')
    ).toBe(false)
    expect(
      reads_inside('https://api.test/list/2', 'https://api.test/list')
    ).toBe(true)
    expect(
      reads_inside('https://api.test/list?q=2', 'https://api.test/list')
    ).toBe(true)
    expect(
      reads_inside(
        'https://www.workatastartup.com/jobs/9',
        'https://www.workatastartup.com/'
      )
    ).toBe(true)
    expect(
      reads_inside(
        'https://www.workatastartup.com/jobs/9',
        'https://www.workatastartup.com/jobs/<id>'
      )
    ).toBe(true)
    expect(
      reads_inside(
        'https://ubuntu.com/security/CVE-2024-1234',
        'https://ubuntu.com/security/CVE-<year>-<number>'
      )
    ).toBe(true)
    expect(
      reads_inside(
        'https://ubuntu.com/security/notices/CVE-2024-1234',
        'https://ubuntu.com/security/CVE-<year>-<number>'
      )
    ).toBe(false)
  })

  it('a list or a saved log fetches nothing, so it is not a read', () => {
    const allowed = ['https://board.test/jobs']
    expect(
      read_outside(
        'grep -oP \'href="https://other.test/jobs/\\d+"\' saved.log',
        allowed
      )
    ).toBe('')
    expect(
      read_outside('curl -s https://other.test/jobs > page.html', allowed)
    ).toBe('https://other.test/jobs')
  })

  it('a pattern in a filter is not a page read', () => {
    expect(
      read_outside(
        `curl -sL "https://x.test/a" | grep -oP 'href="https://[^"]*'`,
        ['https://x.test/a']
      )
    ).toBe('')
    expect(
      read_outside(
        `curl -sL "https://x.test/a" | grep -oP 'href="https://www\\.'`,
        ['https://x.test/a']
      )
    ).toBe('')
  })

  it('a fetch after a pipe is still a page read', () => {
    expect(
      read_outside('cat list | xargs curl https://other.test/b', [
        'https://x.test/a'
      ])
    ).toBe('https://other.test/b')
  })

  it('a source that names no page allows no page', () => {
    expect(read_outside('curl https://any.test/x', [])).toBe(
      'https://any.test/x'
    )
  })
})

describe('a run ends on its own events', () => {
  it('the write of finds.html ends the run, and every step is on screen and on disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-events-'))
    const bin = await fake_pi(dir, [
      start('1', { command: 'realness-read --site yc --brief https://x' }),
      end('1', 'bash', '<article>job</article>'),
      start('2', { path: `${dir}/finds.html` }),
      end('2', 'write', 'wrote it', { path: `${dir}/finds.html` })
    ])
    const said = []
    const code = await local_pi(bin, line => said.push(line))(
      'brief',
      dir,
      null,
      ['https://x']
    )
    expect(code).toBe(0)
    expect(said).toHaveLength(2)
    expect(said[0]).toMatch(/bash {2}realness-read --site yc/)
    const page = await readFile(join(dir, 'steps.html'), 'utf8')
    expect(page.match(/itemtype="\/step"/g)).toHaveLength(2)
    await rm(dir, { recursive: true })
  })

  it('pi settling ends the run, though its process lingers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-events-'))
    const bin = await fake_pi(dir, [{ type: 'agent_settled', aborted: false }])
    expect(await local_pi(bin)('brief', dir)).toBe(0)
    await rm(dir, { recursive: true })
  })

  it('a model error ends the run at once and says why', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-events-'))
    const bin = await fake_pi(dir, [
      {
        type: 'message_end',
        message: { stopReason: 'error', errorMessage: 'API key auth failed' }
      }
    ])
    expect(await local_pi(bin)('brief', dir)).not.toBe(0)
    expect(await readFile(join(dir, 'pi.log'), 'utf8')).toMatch(
      /API key auth failed/
    )
    await rm(dir, { recursive: true })
  })

  it('a page fetched outside the source is named in the log and the run goes on', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-events-'))
    const bin = await fake_pi(dir, [
      start('1', { command: 'realness-read https://board.test/jobs' }),
      end('1', 'bash', 'jobs'),
      start('2', { command: 'curl https://other.test/jobs?page=4' }),
      end('2', 'bash', 'more jobs'),
      { type: 'agent_settled' }
    ])
    const code = await local_pi(bin)('brief', dir, null, [
      'https://board.test/jobs'
    ])
    expect(code).toBe(0)
    expect(await readFile(join(dir, 'pi.log'), 'utf8')).toMatch(
      /a read past the source's list, the reader decides: https:\/\/other\.test\/jobs\?page=4/
    )
    await rm(dir, { recursive: true })
  })

  it('a page on an origin the run read a link from is not outside', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-hops-'))
    const bin = await fake_pi(dir, [
      start('1', { command: 'realness-read https://board.test/jobs' }),
      end('1', 'bash', 'jobs'),
      start('2', { command: 'curl https://company.test/newsroom' }),
      end('2', 'bash', 'newsroom'),
      { type: 'agent_settled' }
    ])
    await writeFile(
      join(dir, 'hops.json'),
      JSON.stringify(['https://company.test'])
    )
    const code = await local_pi(bin)('brief', dir, null, [
      'https://board.test/jobs'
    ])
    expect(code).toBe(0)
    expect(await readFile(join(dir, 'pi.log'), 'utf8')).not.toMatch(
      /a read past the source's list/
    )
    await rm(dir, { recursive: true })
  })

  it('realness-read refuses an outside page itself, so the run goes on', () => {
    expect(
      read_outside('realness-read --brief https://other.test/jobs', [
        'https://board.test/jobs'
      ])
    ).toBe('')
  })

  it('pi gets the source list, so realness-read can refuse an outside page', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-env-'))
    const bin = join(dir, 'fake-pi.cjs')
    await writeFile(
      bin,
      `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(join(dir, 'allowed'))}, process.env.REALNESS_READ_ALLOWED ?? '')\n`
    )
    await chmod(bin, 0o755)
    await local_pi(bin)('brief', dir, null, ['https://board.test/jobs'])
    expect(JSON.parse(await readFile(join(dir, 'allowed'), 'utf8'))).toEqual([
      'https://board.test/jobs'
    ])
    await rm(dir, { recursive: true })
  })

  it('a refused story page is skipped and the run goes on', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-events-'))
    const bin = await fake_pi(dir, [
      start('1', {
        command: 'realness-read https://news.test/rss/articles/abc'
      }),
      end(
        '1',
        'bash',
        'realness-read: could not read https://news.test/rss/articles/abc: chrome: HTTP 403'
      ),
      { type: 'agent_settled' }
    ])
    const code = await local_pi(bin)('brief', dir, null, [
      'https://news.test/rss/search?q=x',
      'https://news.test/rss/articles/<id>'
    ])
    expect(code).toBe(0)
    expect(await readFile(join(dir, 'pi.log'), 'utf8')).not.toMatch(
      /a read was refused/
    )
    await rm(dir, { recursive: true })
  })

  it('a refused read ends the run at once and says why', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-events-'))
    const bin = await fake_pi(dir, [
      start('1', { command: 'fetch-site one' }),
      end('1', 'bash', 'static: HTTP 403; chrome: HTTP 403')
    ])
    const said = []
    const code = await local_pi(bin, line => said.push(line))('brief', dir)
    expect(code).not.toBe(0)
    expect(said[0]).toMatch(/-> HTTP 403/)
    expect(await readFile(join(dir, 'pi.log'), 'utf8')).toMatch(
      /a read was refused: HTTP 403/
    )
    await rm(dir, { recursive: true })
  })
})
