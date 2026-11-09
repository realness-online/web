import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { scout_page } from '../../../src/scouts/scout.js'
import { main } from '../../../scripts/scout.js'

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
