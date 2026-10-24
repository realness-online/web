/* eslint-disable no-await-in-loop -- Chunks append in order; each waits for the last. */
/**
 * Durable's file calls on the person's VM, each one a short command through
 * the same exec relay bash uses. Read, write, and edit need only these.
 */

const FAILED = 3
const KIB = 1024
const CHUNK_KIB = 64
const CHUNK = CHUNK_KIB * KIB
const MS_PER_SECOND = 1000
const KINDS = {
  'regular file': 'file',
  'regular empty file': 'file',
  directory: 'directory',
  'symbolic link': 'symlink'
}
const CODES = new Set([
  'not_found',
  'permission_denied',
  'not_directory',
  'is_directory',
  'invalid'
])

const ok = value => ({ ok: true, value })

/**
 * A durable `FileError`, built by name so the tools read its code.
 * @param {string} code
 * @param {string} message
 * @param {string} [path]
 */
export const file_error = (code, message, path) => ({
  ok: false,
  error: Object.assign(new Error(message), { name: 'FileError', code, path })
})

/**
 * One absolute POSIX path, with `.` and `..` resolved.
 * @param {string} path
 */
export const normal = path => {
  const parts = []
  for (const part of path.split('/'))
    if (part === '..') parts.pop()
    else if (part && part !== '.') parts.push(part)
  return `/${parts.join('/')}`
}

const to_base64 = bytes => {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

const from_base64 = text =>
  Uint8Array.from(atob(text.trim()), character => character.charCodeAt(0))

/** Refuse a missing, unreadable, or directory path before reading it. */
const READABLE = `p="$1"
[ -e "$p" ] || { echo not_found >&2; exit ${FAILED}; }
[ -d "$p" ] && { echo is_directory >&2; exit ${FAILED}; }
[ -r "$p" ] || { echo permission_denied >&2; exit ${FAILED}; }`

/**
 * @param {{ LineScanner: new (start: number, end?: number) => { push: (bytes: Uint8Array) => void, finish: () => object } }} durable
 * @param {{ cwd: string, exec: (command: string | readonly string[], options: object, context: object) => Promise<{ ok: true, value: { exitCode: number } } | { ok: false, error: Error }> }} shell
 */
export const create_vm_files = ({ LineScanner }, shell) => {
  const run = async (script, args, context) => {
    let out = ''
    let err = ''
    const result = await shell.exec(
      ['/bin/bash', '-c', script, 'vm-files', ...args],
      {
        onOutput: (text, _context, { stream }) => {
          if (stream === 'stdout') out += text
          else err += text
        }
      },
      context
    )
    if (!result.ok) return { failed: result.error }
    return { code: result.value.exitCode, out, err }
  }

  const failure = (reply, path) => {
    if (reply.failed)
      return file_error(
        reply.failed.code === 'aborted' ? 'aborted' : 'unknown',
        reply.failed.message,
        path
      )
    const code = reply.err.trim().split('\n').at(-1) ?? ''
    if (reply.code === FAILED && CODES.has(code))
      return file_error(code, `${code.replace('_', ' ')}: ${path}`, path)
    return file_error('unknown', reply.err.trim() || `failed: ${path}`, path)
  }

  const absolute = path =>
    normal(path.startsWith('/') ? path : `${shell.cwd}/${path}`)

  const read_bytes = async (path, context) => {
    const target = absolute(path)
    const reply = await run(
      `${READABLE}\nbase64 -w0 -- "$p"`,
      [target],
      context
    )
    if (reply.failed || reply.code !== 0) return failure(reply, target)
    return ok(from_base64(reply.out))
  }

  const info = async (path, context) => {
    const target = absolute(path)
    const reply = await run(
      `[ -e "$1" ] || { echo not_found >&2; exit ${FAILED}; }\nstat -L -c '%F|%s|%Y' -- "$1"`,
      [target],
      context
    )
    if (reply.failed || reply.code !== 0) return failure(reply, target)
    const [kind, size, seconds] = reply.out.trim().split('|')
    return ok({
      name: target.split('/').at(-1) ?? '',
      path: target,
      kind: KINDS[kind] ?? 'file',
      size: Number(size),
      mtimeMs: Number(seconds) * MS_PER_SECOND
    })
  }

  const write = async (path, content, context, append = false) => {
    const target = absolute(path)
    const bytes =
      typeof content === 'string' ? new TextEncoder().encode(content) : content
    const encoded = to_base64(bytes)
    const first = append ? '>>' : '>'
    const prepare = await run(
      `mkdir -p -- "$(dirname -- "$1")" && : ${first} "$1"`,
      [target],
      context
    )
    if (prepare.failed || prepare.code !== 0) return failure(prepare, target)
    for (let at = 0; at < encoded.length; at += CHUNK) {
      const reply = await run(
        'printf %s "$2" | base64 -d >> "$1"',
        [target, encoded.slice(at, at + CHUNK)],
        context
      )
      if (reply.failed || reply.code !== 0) return failure(reply, target)
    }
    return ok(undefined)
  }

  const unsupported = path =>
    Promise.resolve(
      file_error('not_supported', 'Not available on the VM yet', path)
    )

  return {
    id: 'realness-vm',
    absolutePath: path => Promise.resolve(ok(absolute(path))),
    joinPath: parts => Promise.resolve(ok(absolute(parts.join('/')))),
    async exists(path, context) {
      const reply = await run('[ -e "$1" ]', [absolute(path)], context)
      if (reply.failed) return failure(reply, path)
      return ok(reply.code === 0)
    },
    async canonicalPath(path, context) {
      const target = absolute(path)
      const reply = await run(
        `realpath -e -- "$1" 2>/dev/null || { echo not_found >&2; exit ${FAILED}; }`,
        [target],
        context
      )
      if (reply.failed || reply.code !== 0) return failure(reply, target)
      return ok(reply.out.trim())
    },
    fileInfo: info,
    readBinaryFile: read_bytes,
    async readTextFile(path, context) {
      const bytes = await read_bytes(path, context)
      if (!bytes.ok) return bytes
      return ok(new TextDecoder().decode(bytes.value))
    },
    async readTextLines(path, options, context) {
      const text = await this.readTextFile(path, context)
      if (!text.ok) return text
      const lines = text.value.split('\n')
      return ok(
        options?.maxLines === undefined
          ? lines
          : lines.slice(0, options.maxLines)
      )
    },
    async openBinaryReader(path, _options, context) {
      const [described, bytes] = [
        await info(path, context),
        await read_bytes(path, context)
      ]
      if (!described.ok) return described
      if (!bytes.ok) return bytes
      const data = bytes.value
      return ok({
        info: () => Promise.resolve(described),
        read: (offset, length) =>
          Promise.resolve(ok(data.subarray(offset, offset + length))),
        scanLines: ({ startLine, endLine }) => {
          let scanner
          try {
            scanner = new LineScanner(startLine, endLine)
          } catch {
            return Promise.resolve(
              file_error('invalid', 'Invalid line range', path)
            )
          }
          scanner.push(data)
          return Promise.resolve(ok(scanner.finish()))
        },
        close: () => Promise.resolve()
      })
    },
    writeFile: (path, content, context) => write(path, content, context),
    appendFile: (path, content, context) => write(path, content, context, true),
    async createDir(path, _options, context) {
      const target = absolute(path)
      const reply = await run('mkdir -p -- "$1"', [target], context)
      if (reply.failed || reply.code !== 0) return failure(reply, target)
      return ok(undefined)
    },
    async renameFile(source, destination, context) {
      const reply = await run(
        'mv -- "$1" "$2"',
        [absolute(source), absolute(destination)],
        context
      )
      if (reply.failed || reply.code !== 0) return failure(reply, source)
      return ok(undefined)
    },
    async remove(path, options, context) {
      const flags = `${options?.recursive ? 'r' : ''}${options?.force ? 'f' : ''}`
      const reply = await run(
        `rm ${flags ? `-${flags}` : ''} -- "$1"`,
        [absolute(path)],
        context
      )
      if (reply.failed || reply.code !== 0) return failure(reply, path)
      return ok(undefined)
    },
    flushFile: () => Promise.resolve(ok(undefined)),
    truncateFile: unsupported,
    listDir: unsupported,
    openDirReader: unsupported,
    openTextLineReader: unsupported,
    watch: unsupported,
    createTempDir: unsupported,
    createTempFile: unsupported
  }
}
