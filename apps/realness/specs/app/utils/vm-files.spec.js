import { describe, expect, it, vi } from 'vite-plus/test'
import { create_vm_files, normal } from '@/utils/vm-files'

const context = {}
const bytes = text => new TextEncoder().encode(text)
const b64 = text => btoa(text)

class FakeScanner {
  constructor(start, end) {
    if (start < 0) throw new RangeError('bad')
    this.range = [start, end]
    this.size = 0
  }
  push(chunk) {
    this.size += chunk.length
  }
  finish() {
    return { range: this.range, size: this.size }
  }
}

/**
 * A shell that answers each script with the reply `answer` picks.
 * @param {(script: string, args: string[]) => { code?: number, out?: string, err?: string }} answer
 */
const shell_for = answer => {
  const calls = []
  const exec = vi.fn(async (argv, options) => {
    const [, , script, , ...args] = argv
    calls.push({ script, args })
    const { code = 0, out = '', err = '' } = answer(script, args)
    if (out) options.onOutput(out, context, { stream: 'stdout' })
    if (err) options.onOutput(err, context, { stream: 'stderr' })
    return { ok: true, value: { exitCode: code } }
  })
  return {
    calls,
    files: create_vm_files(
      { LineScanner: FakeScanner },
      { cwd: '/realness', exec }
    )
  }
}

describe('vm files', () => {
  it('resolves paths against the working folder', async () => {
    const { files } = shell_for(() => ({}))
    expect(normal('/a/./b/../c/')).toBe('/a/c')
    expect((await files.absolutePath('notes/x.md', context)).value).toBe(
      '/realness/notes/x.md'
    )
    expect((await files.joinPath(['/a', '..', 'b'], context)).value).toBe('/b')
  })

  it('reads a file as text through base64', async () => {
    const { files, calls } = shell_for(() => ({ out: b64('hello\n') }))
    const result = await files.readTextFile('a.txt', context)
    expect(result).toEqual({ ok: true, value: 'hello\n' })
    expect(calls[0].args).toEqual(['/realness/a.txt'])
  })

  it('turns a missing file into a not_found FileError', async () => {
    const { files } = shell_for(() => ({ code: 3, err: 'not_found\n' }))
    const result = await files.readTextFile('/gone', context)
    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({
      name: 'FileError',
      code: 'not_found',
      path: '/gone'
    })
  })

  it('writes in chunks after making the parent folder', async () => {
    const { files, calls } = shell_for(() => ({}))
    const big = 'x'.repeat(100_000)
    expect(await files.writeFile('/w/f.txt', big, context)).toEqual({
      ok: true,
      value: undefined
    })
    expect(calls[0].script).toContain('mkdir -p')
    const written = calls
      .slice(1)
      .map(call => call.args[1])
      .join('')
    expect(atob(written)).toBe(big)
    expect(calls.length).toBeGreaterThan(2)
  })

  it('describes a file from stat', async () => {
    const { files } = shell_for(() => ({ out: 'regular file|12|1700000000\n' }))
    const result = await files.fileInfo('/r/a.md', context)
    expect(result.value).toEqual({
      name: 'a.md',
      path: '/r/a.md',
      kind: 'file',
      size: 12,
      mtimeMs: 1_700_000_000_000
    })
  })

  it('opens a reader that slices and scans the fetched bytes', async () => {
    const { files } = shell_for(script =>
      script.includes('stat')
        ? { out: 'regular file|6|1\n' }
        : { out: b64('ab\ncd\n') }
    )
    const reader = (await files.openBinaryReader('/f', undefined, context))
      .value
    expect((await reader.read(3, 2, context)).value).toEqual(bytes('cd'))
    expect((await reader.scanLines({ startLine: 1 }, context)).value).toEqual({
      range: [1, undefined],
      size: 6
    })
    expect(
      (await reader.scanLines({ startLine: -1 }, context)).error.code
    ).toBe('invalid')
  })

  it('reports a relay failure as an unknown FileError', async () => {
    const exec = async () => ({
      ok: false,
      error: Object.assign(new Error('halo unreachable'), { code: 'unknown' })
    })
    const files = create_vm_files(
      { LineScanner: FakeScanner },
      { cwd: '/', exec }
    )
    const result = await files.exists('/x', context)
    expect(result.error).toMatchObject({
      code: 'unknown',
      message: 'halo unreachable'
    })
  })

  it('names an aborted relay call as aborted', async () => {
    const exec = async () => ({
      ok: false,
      error: Object.assign(new Error('stopped'), { code: 'aborted' })
    })
    const files = create_vm_files(
      { LineScanner: FakeScanner },
      { cwd: '/', exec }
    )
    expect((await files.readTextFile('/x', context)).error.code).toBe('aborted')
  })

  it('keeps an unrecognized failure as unknown with what the shell said', async () => {
    const said = shell_for(() => ({ code: 1, err: 'disk full\n' }))
    expect((await said.files.createDir('/d', {}, context)).error).toMatchObject(
      { code: 'unknown', message: 'disk full' }
    )
    const silent = shell_for(() => ({ code: 2 }))
    expect(
      (await silent.files.readBinaryFile('/b', context)).error.message
    ).toBe('failed: /b')
    const unlisted = shell_for(() => ({ code: 3, err: 'strange\n' }))
    expect((await unlisted.files.fileInfo('/s', context)).error.code).toBe(
      'unknown'
    )
  })

  it('names folders, links, and unknown kinds from stat', async () => {
    for (const [kind, expected] of [
      ['directory', 'directory'],
      ['symbolic link', 'symlink'],
      ['socket', 'file']
    ]) {
      const { files } = shell_for(() => ({ out: `${kind}|0|1\n` }))
      expect((await files.fileInfo('/k', context)).value.kind).toBe(expected)
    }
    const { files } = shell_for(() => ({ out: 'directory|0|1\n' }))
    expect((await files.fileInfo('/', context)).value.name).toBe('')
  })

  it('appends bytes without truncating, and stops on a failed step', async () => {
    const appended = shell_for(() => ({}))
    await appended.files.appendFile('/a', bytes('more'), context)
    expect(appended.calls[0].script).toContain('>> "$1"')
    expect(atob(appended.calls[1].args[1])).toBe('more')
    const unprepared = shell_for(() => ({
      code: 3,
      err: 'permission_denied\n'
    }))
    expect(
      (await unprepared.files.writeFile('/p', 'x', context)).error.code
    ).toBe('permission_denied')
    const broken = shell_for(script =>
      script.includes('base64 -d') ? { code: 1, err: 'no space\n' } : {}
    )
    expect(
      (await broken.files.writeFile('/w', 'x', context)).error.message
    ).toBe('no space')
  })

  it('answers whether a path exists', async () => {
    const yes = shell_for(() => ({}))
    expect((await yes.files.exists('a', context)).value).toBe(true)
    const no = shell_for(() => ({ code: 1 }))
    expect((await no.files.exists('a', context)).value).toBe(false)
  })

  it('resolves a canonical path or says it is missing', async () => {
    const found = shell_for(() => ({ out: '/real/a\n' }))
    expect((await found.files.canonicalPath('a', context)).value).toBe(
      '/real/a'
    )
    const missing = shell_for(() => ({ code: 3, err: 'not_found\n' }))
    expect((await missing.files.canonicalPath('a', context)).error.code).toBe(
      'not_found'
    )
  })

  it('reads lines, all of them or the first few', async () => {
    const { files } = shell_for(() => ({ out: b64('a\nb\nc') }))
    expect((await files.readTextLines('/t', undefined, context)).value).toEqual(
      ['a', 'b', 'c']
    )
    expect(
      (await files.readTextLines('/t', { maxLines: 2 }, context)).value
    ).toEqual(['a', 'b'])
    const missing = shell_for(() => ({ code: 3, err: 'is_directory\n' }))
    expect(
      (await missing.files.readTextLines('/t', {}, context)).error.code
    ).toBe('is_directory')
  })

  it('opens no reader when the file cannot be described or read', async () => {
    const undescribed = shell_for(() => ({ code: 3, err: 'not_found\n' }))
    expect(
      (await undescribed.files.openBinaryReader('/f', undefined, context)).ok
    ).toBe(false)
    const unreadable = shell_for(script =>
      script.includes('stat')
        ? { out: 'regular file|1|1\n' }
        : { code: 3, err: 'permission_denied\n' }
    )
    expect(
      (await unreadable.files.openBinaryReader('/f', undefined, context)).error
        .code
    ).toBe('permission_denied')
    const readable = shell_for(script =>
      script.includes('stat')
        ? { out: 'regular file|1|1\n' }
        : { out: b64('x') }
    )
    const reader = (
      await readable.files.openBinaryReader('/f', undefined, context)
    ).value
    expect((await reader.info()).value.size).toBe(1)
    await expect(reader.close()).resolves.toBeUndefined()
  })

  it('renames, removes with only the flags asked for, and reports failures', async () => {
    const { files, calls } = shell_for(() => ({}))
    expect((await files.renameFile('a', '/b', context)).ok).toBe(true)
    expect(calls[0].args).toEqual(['/realness/a', '/b'])
    await files.remove('x', undefined, context)
    await files.remove('x', { recursive: true }, context)
    await files.remove('x', { force: true }, context)
    await files.remove('x', { recursive: true, force: true }, context)
    expect(calls.slice(1).map(call => call.script)).toEqual([
      'rm  -- "$1"',
      'rm -r -- "$1"',
      'rm -f -- "$1"',
      'rm -rf -- "$1"'
    ])
    expect((await files.createDir('d', {}, context)).ok).toBe(true)
    const refused = shell_for(() => ({ code: 3, err: 'permission_denied\n' }))
    expect((await refused.files.renameFile('a', 'b', context)).error.path).toBe(
      'a'
    )
    expect((await refused.files.remove('a', {}, context)).error.code).toBe(
      'permission_denied'
    )
  })

  it('flushes as a no-op and refuses what the VM cannot do yet', async () => {
    const { files, calls } = shell_for(() => ({}))
    expect(await files.flushFile('/f', context)).toEqual({
      ok: true,
      value: undefined
    })
    for (const name of [
      'truncateFile',
      'listDir',
      'openDirReader',
      'openTextLineReader',
      'watch',
      'createTempDir',
      'createTempFile'
    ])
      expect((await files[name]('/x')).error.code).toBe('not_supported')
    expect(calls).toEqual([])
  })
})
