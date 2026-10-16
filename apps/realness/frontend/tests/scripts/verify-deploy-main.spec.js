import { describe, expect, it } from 'vite-plus/test'
import { main } from '../../scripts/verify-deploy.js'

/** Capture what a run printed, since main writes to the console. */
const capture = async run => {
  const lines = { out: [], err: [] }
  const original_info = console.info
  const original_error = console.error
  console.info = message => lines.out.push(String(message))
  console.error = message => lines.err.push(String(message))
  try {
    return {
      code: await run(),
      said: lines.out.join('\n'),
      failed: lines.err.join('\n')
    }
  } finally {
    console.info = original_info
    console.error = original_error
  }
}

/** A run whose manifest and file checks are both supplied. */
const run = (manifest, source, ok = true) =>
  capture(() =>
    main([], {
      load: async () => ({ manifest, source }),
      verify: async (base, file_path) => ({ file_path, ok })
    })
  )

describe('verify-deploy main', () => {
  it('prints the help text and succeeds', async () => {
    const result = await capture(() => main(['--help']))
    expect(result.code, 0)
    expect(result.said, /Verify a live Realness instance/)
  })

  it('refuses a manifesto with nothing to verify', async () => {
    const result = await run({ files: {} }, 'file:/tmp/m.json')
    expect(result.code, 1)
    expect(result.failed, /Manifesto has no files to verify/)
  })

  it('names the GitHub release as independent evidence', async () => {
    const result = await run(
      { version: '2.0.0', files: { '/a.js': 'sha256:a' } },
      'github:o/r@v2.0.0'
    )
    expect(result.code, 0)
    expect(result.said, /Trust:     GitHub release \(independent\)/)
    expect(result.said, /Source:    github:o\/r@v2\.0\.0/)
    expect(result.said, /Result:    LEGIT/)
  })

  it('names a local manifesto, and the site alone as not independent', async () => {
    const local = await run(
      { files: { '/a.js': 'sha256:a' } },
      'file:/tmp/m.json'
    )
    expect(local.said, /Trust:     local manifesto/)
    const site = await run(
      { files: { '/a.js': 'sha256:a' } },
      'site:https://a.test/build-manifest.json'
    )
    expect(site.said, /Trust:     site manifesto only \(not independent\)/)
  })

  it('leaves out OS junk and says how many paths it skipped', async () => {
    const manifest = {
      files: {
        '/a.js': 'sha256:a',
        '/.DS_Store': 'sha256:b',
        '/. _thing': 'sha256:c'
      }
    }
    const result = await run(manifest, 'file:/tmp/m.json')
    expect(result.code, 0)
    expect(result.said, /Checking:  1 files/)
    expect(result.said, /Skipping:  2 junk path\(s\)/)
  })

  it('says (none) for a manifesto without a version or commit', async () => {
    const result = await run(
      { files: { '/a.js': 'sha256:a' } },
      'file:/tmp/m.json'
    )
    expect(result.said, /Version:   \(none\)/)
    expect(result.said, /Commit:    \(none\)/)
    expect(result.said, /Bundle:/)
  })

  it('prints the bundle hash when the manifesto carries one', async () => {
    const result = await run(
      {
        version: '1.0.0',
        bundle_sha256: 'sha256:abc',
        files: { '/a.js': 'sha256:a' }
      },
      'file:/tmp/m.json'
    )
    expect(result.said, /Bundle:    sha256:abc/)
  })

  it('names each file that does not match and fails', async () => {
    const result = await capture(() =>
      main([], {
        load: async () => ({
          manifest: { files: { '/a.js': 'sha256:a', '/b.js': 'sha256:b' } },
          source: 'file:/tmp/m.json'
        }),
        verify: async (base, file_path) => ({
          file_path,
          ok: file_path === '/a.js'
        })
      })
    )
    expect(result.code, 1)
    expect(result.said, /Files:     1\/2 match/)
    expect(result.failed, /FAIL \/b\.js/)
    expect(result.failed, /Result:    NOT LEGIT/)
  })

  it('checks every file it was given, in path order', async () => {
    const checked = []
    const result = await capture(() =>
      main([], {
        load: async () => ({
          manifest: {
            files: {
              '/z.js': 'sha256:z',
              '/a.js': 'sha256:a',
              '/m.js': 'sha256:m'
            }
          },
          source: 'file:/tmp/m.json'
        }),
        verify: async (base, file_path) => {
          checked.push(file_path)
          return { file_path, ok: true }
        }
      })
    )
    expect(result.code, 0)
    expect(checked, ['/a.js', '/m.js', '/z.js'])
    expect(result.said, /Files:     3\/3 match/)
  })
})
