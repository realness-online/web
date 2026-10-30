#!/usr/bin/env node
/**
 * Realness actor terminal - a pty on the guest end of the vsock channel.
 *
 * socat runs one copy of this per connection (VSOCK-LISTEN:53,fork) with pipes
 * on stdin and stdout. Frames are JSON lines:
 *
 *     in    {"op": "data", "data_b64": "..."}
 *           {"op": "resize", "cols": 100, "rows": 30}
 *           {"op": "session", "name": "s2"}   first frame only: a split pane's own shell
 *           {"op": "close"}   end this session's shell
 *
 * `realness-pty busy` prints the named sessions running a foreground job.
 *     out   {"op": "data", "data_b64": "..."}
 *           {"op": "exit", "code": 0}
 *           {"op": "taken"}   another connection took the terminal
 *
 * The terminal outlives the connection. One holder process per guest owns the
 * pty and the shell; each connection is a thin relay to it over a unix socket.
 * A new connection takes the terminal over from the old one, so a browser
 * refresh reattaches to the running Pi instead of paying its startup again.
 *
 * A connection that names a session in its first frame gets that session's own
 * holder and shell, for a split pane; without a name it is the terminal Pi runs
 * in. At most MAX_SESSIONS named sessions run at once.
 *
 * socat, not Python, owns the pty: `socat UNIX-LISTEN:… EXEC:/bin/bash,pty` is
 * the whole of the allocation, and `stty -F` is the window size.
 */
import { execFileSync as exec_file_sync, spawn } from 'node:child_process'
import {
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  existsSync as exists_sync,
  unlinkSync as unlink_sync,
  writeFileSync as write_file_sync,
  chmodSync as chmod_sync,
  readlinkSync as readlink_sync
} from 'node:fs'
import { createServer as create_server, connect } from 'node:net'
import { fileURLToPath as file_url_to_path } from 'node:url'

const SHELL = '/bin/bash'
const USER = 'realness'
/** The visible terminal starts at the harness root, as on the person's own machine. */
const HARNESS_DIR = '/realness'
export const SOCKET = '/run/realness-pty.sock'
export const SESSION_NAME = /^[a-z0-9][a-z0-9-]{0,15}$/
export const MAX_SESSIONS = 8
/** Keys typed from inside the actor (the chat bridge running a GUI command). */
const KEYS_SOCKET = '/run/realness/pty-keys.sock'
/** Longest escape sequence held back for the next read. */
const ESCAPE_TAIL = 24
const HOLDER_WAIT_TRIES = 100
const HOLDER_WAIT_MS = 20
const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24
const OPENER = 'realness\r'
/** Modes an app sets once at startup, replayed to a browser that attaches later. */
/**
 * Modes an app sets once at startup: alternate screen, mouse reports, focus,
 * bracketed paste. Named, because a browser that attaches later never saw them.
 */
const ALTERNATE_SCREEN = 1049
const MOUSE_CLICKS = 1000
const MOUSE_DRAG = 1002
const MOUSE_MOVE = 1003
const MOUSE_ANY = 1004
const MOUSE_SGR = 1006
const BRACKETED_PASTE = 2004
export const REPLAY_MODES = [
  ALTERNATE_SCREEN,
  MOUSE_CLICKS,
  MOUSE_DRAG,
  MOUSE_MOVE,
  MOUSE_ANY,
  MOUSE_SGR,
  BRACKETED_PASTE
]
const ESC = '\u001b'
const OWNER_ONLY = 0o600
const NEWLINE = '\n'.charCodeAt(0)
const DEC_MODE = new RegExp(`${ESC}\\[\\?([0-9;]+)([hl])`, 'g')
/** Kitty keyboard: CSI > flags u pushes, CSI < n u pops. */
const KITTY = new RegExp(`${ESC}\\[([<>])([0-9]*)u`, 'g')
const MAX_SESSIONS_MESSAGE = `at most ${MAX_SESSIONS} sessions`

export const frame = payload => Buffer.from(`${JSON.stringify(payload)}\n`)
export const b64 = bytes => Buffer.from(bytes).toString('base64')

/** Where a session's holder listens. */
export const session_socket = name =>
  name ? `/run/realness-pty-${name}.sock` : SOCKET

/**
 * The session a first frame names: null for the Pi terminal, '' for a bad name.
 * @param {string} line
 * @returns {string | null}
 */
export const chosen_session = line => {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    return null
  }
  if (
    typeof message !== 'object' ||
    message === null ||
    message.op !== 'session'
  )
    return null
  const { name } = message
  return typeof name === 'string' && SESSION_NAME.test(name) ? name : ''
}

/**
 * The replayable modes a chunk of app output turns on or off, and the bytes the
 * kitty keyboard stack gains or loses.
 * @param {{ modes: Map<number, boolean>, kitty: number[], carry: string }} state
 * @param {string} data
 * @returns {{ modes: Map<number, boolean>, kitty: number[], carry: string }}
 */
export const track = (state, data) => {
  const modes = new Map(state.modes)
  const kitty = [...state.kitty]
  let text = state.carry + data
  let carry = ''
  const tail = text.lastIndexOf('\x1b')
  if (
    tail !== -1 &&
    text.length - tail < ESCAPE_TAIL &&
    !/[hlu]/.test(text.slice(tail + 2))
  ) {
    carry = text.slice(tail)
    text = text.slice(0, tail)
  }
  for (const [, numbers, action] of text.matchAll(DEC_MODE))
    for (const number of numbers.split(';'))
      if (/^\d+$/.test(number) && REPLAY_MODES.includes(Number(number)))
        modes.set(Number(number), action === 'h')
  for (const [, kind, flags] of text.matchAll(KITTY))
    if (kind === '>') kitty.push(Number(flags || 0))
    else if (kitty.length) kitty.splice(-Math.max(1, Number(flags || 1)))
  return { modes, kitty, carry }
}

/** Sequences that put a fresh browser terminal in the app's modes. */
export const replay = ({ modes, kitty }) => {
  let out = ''
  for (const mode of REPLAY_MODES) if (modes.get(mode)) out += `\x1b[?${mode}h`
  for (const flags of kitty) out += `\x1b[>${flags}u`
  return out
}

/** Named holders that exist right now, as session names. */
export const live_sessions = () =>
  readdir_sync('/run')
    .filter(name => name.startsWith('realness-pty-') && name.endsWith('.sock'))
    .map(name => name.slice('realness-pty-'.length, -'.sock'.length))

/**
 * Whether a named session's shell holds a foreground job.
 * @param {string} name
 */
const is_busy = name => {
  try {
    const pid = Number(
      read_file_sync(`/run/realness-pty-${name}.sock.pid`, 'utf8')
    )
    return foreground_busy(read_file_sync(`/proc/${pid}/stat`, 'utf8'), pid)
  } catch {
    return false
  }
}

/**
 * Named sessions whose shell runs a foreground job: a build, a server, a watch.
 * Pi's own terminal waiting for the person is idle, so it is not counted.
 */
export const busy_sessions = () => live_sessions().filter(is_busy)

/** Shells that are not running a command by themselves. */
const SHELLS = ['/usr/bin/bash', '/bin/bash']

/**
 * Whether a shell's foreground group is some process other than the shell:
 * `/proc/<pid>/stat` field 8 (tpgid), after the command name in parentheses.
 * @param {string} stat the whole stat line
 * @param {number} pid
 * @returns {boolean}
 */
export const foreground_busy = (stat, pid) => {
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const foreground = Number(fields[5])
  return foreground > 0 && foreground !== pid
}

/**
 * Whether a resolved exe path is something other than a shell.
 * @param {string} exe
 */
export const runs_other = exe => !SHELLS.includes(exe)

/** The tty a pid runs on, as `/dev/pts/N`. */
const tty_of = pid => {
  try {
    const link = readlink_sync(`/proc/${pid}/fd/0`)
    return link.startsWith('/dev/') ? link : null
  } catch {
    return null
  }
}

/** The size the client wants. The kernel also signals SIGWINCH for us. */
const set_window = (tty, cols, rows) => {
  try {
    exec_file_sync(
      'stty',
      ['-F', tty, 'rows', String(rows), 'cols', String(cols)],
      {
        stdio: 'ignore'
      }
    )
  } catch {}
}

/**
 * A user's home directory from /etc/passwd.
 * @param {string} name
 * @param {string} [passwd] the file's text
 */
export const home_of = (name, passwd = read_file_sync('/etc/passwd', 'utf8')) =>
  passwd
    .split('\n')
    .map(line => line.split(':'))
    .find(fields => fields[0] === name)?.[5] ?? HARNESS_DIR

/**
 * The shell a holder owns: socat allocates the pty, bash becomes its session
 * leader, and the holder speaks raw bytes over a unix socket.
 */
const start_shell = socket => {
  try {
    unlink_sync(socket)
  } catch {}
  const shell = `setpriv --reuid=${USER} --regid=${USER} --init-groups ${SHELL}`
  const child = spawn(
    'socat',
    [
      `UNIX-LISTEN:${socket},mode=600`,
      `EXEC:${shell},pty,setsid,ctty,stderr,rawer,echo=0`
    ],
    {
      detached: true,
      stdio: 'ignore',
      cwd: HARNESS_DIR,
      env: {
        ...process.env,
        HOME: home_of(USER),
        USER,
        LOGNAME: USER,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    }
  )
  return child
}

/** One holder: the pty's owner and the client currently attached. */
class Holder {
  /**
   * @param {string} path
   * @param {boolean} main the Pi terminal, which also serves keystrokes
   */
  constructor(path, main) {
    this.path = path
    this.main = main
    this.client = null
    this.pending = Buffer.alloc(0)
    this.fresh = false
    this.size = [DEFAULT_COLS, DEFAULT_ROWS]
    /** @type {Map<number, boolean>} */
    this.modes = new Map()
    /** @type {number[]} */
    this.kitty = []
    this.carry = ''
    this.upstream = null
    this.shell = start_shell(`${path}.raw`)
    this.shell_pid = null
    this.listen()
  }

  /** The shell socat started: the first child of the tool we spawned. */
  find_shell() {
    const parent = this.shell.pid
    for (const entry of readdir_sync('/proc')) {
      if (!/^\d+$/.test(entry)) continue
      try {
        const stat = read_file_sync(`/proc/${entry}/stat`, 'utf8')
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
        if (Number(fields[1]) === parent) return Number(entry)
      } catch {}
    }
    return null
  }

  listen() {
    try {
      unlink_sync(this.path)
    } catch {}
    this.listener = create_server(client => this.attach(client))
    this.listener.on('error', () => {})
    this.listener.listen(this.path, () => {
      if (this.main) this.open_keys()
    })
    /** The shell's pty bridge: connect once socat is listening. */
    const dial = () => {
      const upstream = connect(`${this.path}.raw`)
      upstream.on('error', () => setTimeout(dial, 50))
      upstream.on('connect', () => {
        this.upstream = upstream
        this.shell_pid = this.find_shell()
        if (this.shell_pid && !this.main)
          write_file_sync(`${this.path}.pid`, `${this.shell_pid}\n`)
        const tty = this.shell_pid && tty_of(this.shell_pid)
        if (tty) set_window(tty, ...this.size)
        upstream.on('data', data => this.from_shell(data))
        upstream.on('close', () => this.finished())
      })
    }
    dial()
  }

  /** The pty's bytes: replay state, then the page. */
  from_shell(data) {
    Object.assign(this, track(this, data.toString('latin1')))
    this.send(frame({ op: 'data', data_b64: data.toString('base64') }))
  }

  send(data) {
    if (!this.client) return
    this.client.write(data)
  }

  attach(client) {
    if (this.client) {
      this.send(frame({ op: 'taken' }))
      this.client.destroy()
    }
    this.client = client
    this.pending = Buffer.alloc(0)
    this.fresh = true
    const modes = replay(this)
    if (modes) this.send(frame({ op: 'data', data_b64: b64(modes) }))
    client.on('data', chunk => this.from_client(chunk))
    client.on('error', () => {})
    client.on('close', () => {
      if (this.client === client) this.client = null
    })
  }

  /** The keys socket: the chat bridge typing into Pi without taking the page. */
  open_keys() {
    try {
      unlink_sync(KEYS_SOCKET)
    } catch {}
    try {
      this.keys = create_server(socket => {
        socket.once('data', data => this.upstream?.write(data))
        socket.on('error', () => {})
      })
      this.keys.listen(KEYS_SOCKET, () => {
        chmod_sync(KEYS_SOCKET, OWNER_ONLY)
        exec_file_sync('chown', [USER, KEYS_SOCKET], { stdio: 'ignore' })
      })
    } catch {}
  }

  from_client(chunk) {
    this.pending = Buffer.concat([this.pending, chunk])
    let end = this.pending.indexOf(NEWLINE)
    while (end !== -1) {
      const line = this.pending.subarray(0, end).toString()
      this.pending = this.pending.subarray(end + 1)
      if (line.trim()) this.handle(line)
      end = this.pending.indexOf(NEWLINE)
    }
  }

  handle(line) {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (message.op === 'close') this.signal('SIGHUP')
    else if (message.op === 'resize')
      this.resize(Number(message.cols), Number(message.rows))
    else if (message.op === 'data') {
      const data = Buffer.from(message.data_b64 ?? '', 'base64')
      const opener = this.fresh && data.toString() === OPENER
      this.fresh = false
      if (opener && this.running_command()) return
      this.upstream?.write(data)
    }
  }

  /** A command runs in the shell's foreground group, or has replaced it. */
  running_command() {
    if (!this.shell_pid) return false
    try {
      const stat = read_file_sync(`/proc/${this.shell_pid}/stat`, 'utf8')
      if (foreground_busy(stat, this.shell_pid)) return true
      const exe = readlink_sync(`/proc/${this.shell_pid}/exe`)
      return !SHELLS.includes(exe)
    } catch {
      return false
    }
  }

  signal(name) {
    if (!this.shell_pid) return
    try {
      process.kill(-this.shell_pid, name)
    } catch {
      try {
        process.kill(this.shell_pid, name)
      } catch {}
    }
  }

  resize(cols, rows) {
    const tty = this.shell_pid && tty_of(this.shell_pid)
    if (!tty || !Number.isFinite(cols) || !Number.isFinite(rows)) return
    if (this.fresh && cols > 1) {
      set_window(tty, cols - 1, rows)
      exec_file_sync('sleep', ['0.05'], { stdio: 'ignore' })
    }
    this.size = [cols, rows]
    set_window(tty, cols, rows)
  }

  finished() {
    const code = this.shell.exitCode ?? 0
    this.send(frame({ op: 'exit', code }))
    this.cleanup()
  }

  cleanup() {
    for (const path of [
      this.path,
      `${this.path}.pid`,
      `${this.path}.raw`,
      KEYS_SOCKET
    ])
      try {
        unlink_sync(path)
      } catch {}
    process.exit(0)
  }
}

/** Connect to a session's holder, starting one when there is none. */
const connect_holder = path => {
  if (exists_sync(path)) {
    const socket = connect(path)
    return new Promise(done => {
      socket.on('connect', () => done(socket)).on('error', () => done(null))
    })
  }
  return Promise.resolve(null)
}

const start_holder = (path, main) => {
  const child = spawn(
    process.execPath,
    [
      file_url_to_path(import.meta.url),
      '--holder',
      path,
      main ? 'main' : 'session'
    ],
    {
      detached: true,
      stdio: 'ignore'
    }
  )
  child.unref()
}

/**
 * The first frame, so a session name is known before the rest is forwarded;
 * bytes that arrived after it come back as `rest`, untouched.
 * @param {NodeJS.ReadableStream} stdin
 * @returns {Promise<{ line: string, rest: Buffer }>}
 */
export const first_line = stdin =>
  new Promise(done => {
    let buffered = Buffer.alloc(0)
    const on_data = chunk => {
      buffered = Buffer.concat([buffered, chunk])
      const end = buffered.indexOf(NEWLINE)
      if (end === -1) return
      stdin.off('data', on_data)
      stdin.pause()
      done({
        line: buffered.subarray(0, end + 1).toString('utf8'),
        rest: buffered.subarray(end + 1)
      })
    }
    stdin.on('data', on_data)
    stdin.on('end', () =>
      done({ line: buffered.toString('utf8'), rest: Buffer.alloc(0) })
    )
  })

/**
 * Pipe the page and the holder together until either end closes.
 * @param {NodeJS.ReadWriteStream} holder
 * @param {Buffer | string} first bytes already read from the page
 * @param {NodeJS.ReadableStream} [stdin]
 * @param {NodeJS.WritableStream} [stdout]
 */
export const relay = (
  holder,
  first,
  stdin = process.stdin,
  stdout = process.stdout
) => {
  holder.on('data', chunk => stdout.write(chunk))
  holder.on('close', () => process.exit(0))
  if (first.length) holder.write(first)
  stdin.on('data', chunk => holder.write(chunk))
  stdin.on('end', () => holder.end())
  stdin.resume()
}

const main = async () => {
  const [, , first_arg, second, mode] = process.argv
  if (first_arg === 'busy') {
    for (const name of busy_sessions()) process.stdout.write(`${name}\n`)
    return
  }
  if (first_arg === '--holder') {
    new Holder(second, mode === 'main')
    return
  }
  const { line, rest } = await first_line(process.stdin)
  const name = chosen_session(line)
  if (name === '') {
    process.stdout.write(frame({ op: 'error', text: 'bad session name' }))
    return
  }
  const path = session_socket(name)
  let holder = await connect_holder(path)
  if (!holder) {
    if (name !== null && live_sessions().length >= MAX_SESSIONS) {
      process.stdout.write(frame({ op: 'error', text: MAX_SESSIONS_MESSAGE }))
      return
    }
    start_holder(path, name === null)
    /* eslint-disable no-await-in-loop -- the holder binds its socket in its own time */
    for (let i = 0; i < HOLDER_WAIT_TRIES && !holder; i += 1) {
      await new Promise(done => {
        setTimeout(done, HOLDER_WAIT_MS)
      })
      holder = await connect_holder(path)
    }
    /* eslint-enable no-await-in-loop */
  }
  if (!holder) {
    process.stdout.write(
      frame({ op: 'error', text: 'the terminal did not start' })
    )
    return
  }
  relay(holder, name === null ? Buffer.concat([Buffer.from(line), rest]) : rest)
}

/** A spec imports this file for its frame helpers; only the program runs main. */
const invoked =
  process.argv[1] && file_url_to_path(import.meta.url) === process.argv[1]
if (invoked) await main()
