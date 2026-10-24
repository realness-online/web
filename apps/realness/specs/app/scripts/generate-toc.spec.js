import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../../scripts/lib/artifacts.js'
import {
  generate,
  heading_id,
  markdown_toc
} from '../../../scripts/generate-toc.js'

const dirs = []

afterEach(() => {
  for (const dir of dirs.splice(0))
    rm_sync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('generate-toc', () => {
  it('turns titles into anchor ids', () => {
    expect(heading_id('Hello, World!')).toBe('hello-world')
    expect(heading_id('  -Edge  case- ')).toBe('edge-case')
    expect(heading_id(undefined)).toBe('')
  })

  it('collects level 2 to 6 headings only', () => {
    expect(
      markdown_toc('# Title\n## One\ntext\n### Two Words\n####### Seven')
    ).toEqual([
      { id: 'one', title: 'One', level: 2 },
      { id: 'two-words', title: 'Two Words', level: 3 }
    ])
  })

  it('writes an importable module from the content files', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    mkdir_sync(artifacts_dir, { recursive: true })
    const dir = mkdtemp_sync(join(artifacts_dir, 'toc-'))
    dirs.push(dir)
    const content_dir = join(dir, 'content')
    mkdir_sync(content_dir)
    write_file_sync(join(content_dir, 'documentation.md'), '## Start\n')
    write_file_sync(join(content_dir, 'terms.md'), '## Terms\n')
    write_file_sync(join(content_dir, 'privacy.md'), '')
    write_file_sync(join(content_dir, 'license.md'), '### License Text\n')
    const out_path = join(dir, 'prerender', 'toc.js')

    expect(generate({ content_dir, out_path })).toBe(out_path)
    const toc = await import(
      `data:text/javascript,${encodeURIComponent(read_file_sync(out_path, 'utf8'))}`
    )
    expect(toc.documentation_toc[0]).toEqual({
      id: 'start',
      title: 'Start',
      level: 2
    })
    expect(toc.documentation_toc.at(-1).id).toBe('changelog')
    expect(toc.terms_toc).toEqual([{ id: 'terms', title: 'Terms', level: 2 }])
    expect(toc.privacy_toc).toEqual([])
    expect(toc.license_toc[0].level).toBe(3)
  })
})
