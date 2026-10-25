import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { it } from 'node:test'
import { promisify } from 'node:util'

const exec_file = promisify(execFile)
const root = new URL('../../../../', import.meta.url).pathname

for (const script of ['recent.sh', 'rebuild-feeds.sh']) {
  it(`${script} uses the default vault and its unnumbered sections`, async t => {
    const scratch = join(root, 'artifacts/vault')
    await mkdir(scratch, { recursive: true })
    const harness = await mkdtemp(join(scratch, 'path-test-'))
    t.after(() => rm(harness, { recursive: true, force: true }))
    const skill = join(harness, 'skills/vault')
    await mkdir(skill, { recursive: true })
    await copyFile(join(root, '.pi/skills/vault', script), join(skill, script))
    for (const section of ['Projects', 'Areas', 'Resources', 'Archive']) {
      const folder = join(harness, 'vault', section, 'Example')
      await mkdir(folder, { recursive: true })
      await writeFile(join(folder, ':feed.md'), 'old feed\n')
    }
    for (const section of ['journal', 'Clippings', 'Unsorted'])
      await mkdir(join(harness, 'vault', section), { recursive: true })
    await writeFile(join(harness, 'vault/journal/Journal.md'), 'journal marker\n')
    await writeFile(join(harness, 'vault/Projects/Example/status.md'), 'status marker\n')
    const env = { ...process.env }
    delete env.VAULT
    const { stdout, stderr } = await exec_file('bash', [join(skill, script)], { env })
    assert.equal(stderr, '')
    if (script === 'recent.sh') {
      assert.match(stdout, /journal marker/)
      assert.match(stdout, /== newest in Projects/)
      assert.match(stdout, /-- Example\nstatus.md/)
    } else {
      for (const section of ['Projects', 'Areas', 'Resources', 'Archive'])
        assert.match(
          await readFile(join(harness, 'vault', section, 'Example/:feed.md'), 'utf8'),
          new RegExp(`FROM "${section}/Example"`)
        )
    }
  })
}
