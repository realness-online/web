/**
 * BoxStore: local actors as runc containers on the halo's own kernel - one VM
 * layer down, same RouteStore contract as ActorStore. The Firecracker class is
 * untouched and stays the default; this is selected by --runtime box.
 *
 * A box boots the template rootfs read-only (overlay), with tmpfs /run and a
 * writable /realness. The guest agents and their JSON channel are identical to
 * Firecracker's, so `vsock` works over a plain unix socket. Idle tiers: memory
 * keeps the box alive, disk destroys it - work lives in the harness and sync,
 * so a disk-tier box loses only process state, like a Firecracker cold boot.
 */
import {
  appendFileSync as append_file_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  renameSync as rename_sync,
  rmSync as rm_sync,
  statSync as stat_sync,
  writeFileSync as write_file_sync,
  copyFileSync as copy_file_sync,
  chmodSync as chmod_sync,
  chownSync as chown_sync,
  closeSync as close_sync,
  openSync as open_sync
} from 'node:fs'
import { fileURLToPath as file_url_to_path } from 'node:url'
import {
  execFile as exec_file,
  spawn,
  spawnSync as spawn_sync
} from 'node:child_process'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  randomBytes as random_bytes,
  randomUUID as random_uuid,
  createHash as create_hash
} from 'node:crypto'
import { join } from 'node:path'
import { BadRequest, HaloError, NotFound } from './errors.js'
import * as vsock from './vsock.js'
import { wait_for_door } from './door.js'
import { next_step } from './lifecycle.js'
import { sessions_busy } from './sessions-busy.js'
import { logger } from './log.js'
import { create_startup_trace } from '#root/src/harness/startup.js'
import { issue_recovery_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { halo_pass_secret } from '#root/src/sign-on/node/halo-secret.js'
import { hostname } from 'node:os'

const LOG = logger('box')
const RECOVER_SECONDS = 300
/** The app source the box mounts at /usr/local/lib/realness (live checkout in local mode). */
const REALNESS_LIB = '/mnt/fc'
/** hs-f2: the GCE instance name sync fences by; omitted when the name is not one. */
const halo_claim = () => {
  const name = hostname().split('.')[0].toLowerCase()
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(name) ? { halo: name } : {}
}
const ACTOR_INIT = '/usr/local/bin/realness-actor-init'
const HANDSOVER = '/realness/.handover/log.json'
const ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/
const TRACES = 'traces'
const PUBLISHED = 'published'
const VERSIONS = 'published-versions'
const EXPORTS = 'exports'
const ARTIFACT_PATHS = ['realness']
/** Per-box cgroup limits: one runaway box cannot starve the others. */
const MIB = 1024 * 1024
const BOX_MIB = 1536
const BOX_CPUS = 2
const BOX_PIDS = 1024
const CPU_PERIOD = 100_000
/** Root in a box is uid 100000 on the VM: it owns nothing outside the box. */
const USERNS_BASE = 100_000
const USERNS_SIZE = 65_536
const USERNS_MAP = [{ containerID: 0, hostID: USERNS_BASE, size: USERNS_SIZE }]
/** A bind the box writes keeps the VM's uids on disk; idmap shows them shifted. */
const IDMAP = { uidMappings: USERNS_MAP, gidMappings: USERNS_MAP }
const NON_ACTOR_DIRS = new Set([
  'seed',
  'apps',
  TRACES,
  PUBLISHED,
  VERSIONS,
  EXPORTS
])
const run = promisify(exec_file)
const sh = (argv, options = {}) =>
  spawn_sync(argv[0], argv.slice(1), { encoding: 'utf8', ...options })
const now_iso = () => new Date().toISOString().replace(/\.\d+Z$/, '+00:00')
const mint_id = () => `a-${random_bytes(6).toString('hex')}`
const MINTED = /^a-[0-9a-f]{12}$/
const write_json = (path, value) =>
  write_file_sync(path, `${JSON.stringify(value, null, 2)}\n`)

/**
 * A minimal firecracker CONNECT/OK responder inside the box. Each guest agent
 * (exec on 52, pty on 53, chat on 55) gets a socat-bound raw socket; this fronts
 * them with the handshake so the halo's vsock channel needs no changes. The
 * CONNECT port picks the agent, as on Firecracker, so any socket reaches any port.
 */
/**
 * Guest scripts a box takes from this checkout rather than the template: the
 * door clients, which fall back to the /run/realness/door.sock relay a box
 * needs without vsock, and the terminal, so its sessions match this halo.
 */
const GUEST = file_url_to_path(
  new URL('../../server/halo/guest/', import.meta.url)
)
const GUEST_COPIES = [
  'realness-actor-init',
  'realness-chrome',
  'realness-loop',
  'realness-model-pass',
  'realness-publish',
  'realness-pty',
  'realness-read',
  'realness-site'
]

/** `pi` once it holds across two checks, `starting` while its launcher runs. */
const PI_STATE =
  'pgrep -x pi >/dev/null && sleep 0.1 && pgrep -x pi >/dev/null && echo pi && exit 0; ' +
  "pgrep -f '(/usr/local/bin/realness|/realness/bin/pi)( |$)' >/dev/null && echo starting || echo none"
const OPENER_RETRY_MS = 2000
const PI_POLL_MS = 200

const HANDSHAKE_RESPONDER = [
  'import socket, os, threading, time',
  'def pipe(a, b):',
  '    try:',
  '        while True:',
  '            d = a.recv(65536)',
  '            if not d: break',
  '            b.sendall(d)',
  '    except OSError:',
  '        pass',
  'TARGETS = {b"52": "/box/agent.sock", b"53": "/box/pty.sock", b"55": "/box/chat.sock"}',
  'def handle(c, target):',
  '    try:',
  '        line = b""',
  '        while not line.endswith(b"\\n"):',
  '            ch = c.recv(1)',
  '            if not ch: return',
  '            line += ch',
  '        parts = line.split()',
  '        target = TARGETS.get(parts[1] if len(parts) > 1 else b"", target)',
  '        up = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)',
  '        up.connect(target)',
  '        c.sendall(b"OK " + line.split()[1] + b"\\n")',
  '        threading.Thread(target=pipe, args=(c, up), daemon=True).start()',
  '        pipe(up, c)',
  '        c.shutdown(socket.SHUT_RDWR)',
  '        up.close()',
  '    except OSError:',
  '        pass',
  '    finally:',
  '        c.close()',
  'def serve(port, target):',
  '    path = f"/box/sock-{port}"',
  '    try: os.unlink(path)',
  '    except FileNotFoundError: pass',
  '    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)',
  '    s.bind(path); s.listen(16)',
  '    while True:',
  '        c, _ = s.accept()',
  '        threading.Thread(target=handle, args=(c, target), daemon=True).start()',
  'for port, target in [(52, "/box/agent.sock"), (53, "/box/pty.sock"), (55, "/box/chat.sock")]:',
  '    threading.Thread(target=serve, args=(port, target), daemon=True).start()',
  'while True: time.sleep(3600)'
].join('\n')

class Mutex {
  #tail = Promise.resolve()
  run(work) {
    const next = this.#tail.then(work, work)
    this.#tail = next.catch(() => {})
    return next
  }
}

/** A process that still runs and is not a zombie. */
const alive = pid => {
  if (!pid) return false
  try {
    const stat = read_file_sync(`/proc/${pid}/stat`, 'utf8')
    if (stat.slice(stat.lastIndexOf(') ') + 2).split(' ')[0] === 'Z')
      return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const sha256_file = path =>
  create_hash('sha256').update(read_file_sync(path)).digest('hex')

const list_files = root =>
  readdir_sync(root, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))

/** The halo answers the same record fields for a box as for a Firecracker actor. */
const PUBLIC_FIELDS = [
  'id',
  'state',
  'created',
  'tap',
  'pid',
  'hostname',
  'machine_id',
  'boot_id',
  'dir',
  'owner',
  'paths',
  'last_activity',
  'synced_at'
]

class Actor {
  constructor(fields) {
    Object.assign(this, { pid: 0, synced_at: '' }, fields)
  }
  /** Everything the store keeps in actor.json. */
  stored() {
    const rest = { ...this }
    delete rest.startup
    return rest
  }
  /** What the API answers. */
  toJSON() {
    return Object.fromEntries(
      PUBLIC_FIELDS.map(key => [
        key,
        key === 'tap' ? (this.host_veth ?? '') : (this[key] ?? null)
      ])
    )
  }
}

/**
 * The box runs as a privileged, namespaced container: its own pid/uts/network
 * and mount namespaces contain what capabilities can reach. actor-init sets
 * the clock, network, and hostname; the pty drops uid to user `realness`.
 */
const CAPS = [
  'CAP_AUDIT_WRITE',
  'CAP_KILL',
  'CAP_NET_BIND_SERVICE',
  'CAP_SETUID',
  'CAP_SETGID',
  'CAP_CHOWN',
  'CAP_FOWNER',
  'CAP_DAC_OVERRIDE',
  'CAP_MKNOD',
  'CAP_SETPCAP',
  'CAP_NET_RAW',
  'CAP_NET_ADMIN',
  'CAP_SYS_TIME',
  'CAP_SYS_ADMIN',
  'CAP_SYS_PTRACE',
  'CAP_SYS_CHROOT',
  'CAP_SYS_RESOURCE',
  'CAP_SYS_NICE',
  'CAP_SETFCAP',
  'CAP_IPC_LOCK',
  'CAP_SYSLOG',
  'CAP_SYS_TTY_CONFIG',
  'CAP_DAC_READ_SEARCH',
  'CAP_FSETID',
  'CAP_LEASE',
  'CAP_WAKE_ALARM',
  'CAP_BLOCK_SUSPEND'
]

export class BoxStore {
  runtime = 'box'

  constructor(options) {
    Object.assign(this, {
      volume: options.volume,
      template: options.template,
      runc_bin: options.runc ?? 'runc',
      sync_url: options.sync_url ?? null,
      vsock_port: options.vsock_port ?? vsock.VSOCK_PORT,
      boot_timeout: options.boot_timeout ?? 60,
      api_timeout: options.api_timeout ?? 30,
      host_vault: options.host_vault ?? null,
      userns: options.userns ?? true,
      mib: options.mib ?? BOX_MIB,
      cpus: options.cpus ?? BOX_CPUS,
      pids: options.pids ?? BOX_PIDS
    })
    this.traces_dir = join(this.volume, TRACES)
    this.published_dir = join(this.volume, PUBLISHED)
    this.versions_dir = join(this.volume, VERSIONS)
    this.exports_dir = join(this.volume, EXPORTS)
    this.lock = new Mutex()
    this.publishing = new Mutex()
    this.busy = new Map()
    this.turned = new Set()
    /** Ids whose create is still running; create does not hold the lock. */
    this.creating = new Set()
    this.closed = false
  }

  box_dir(id) {
    return join(this.volume, id, 'box')
  }

  /** The actor's address: 172.16.<n>.2/30, gateway .1 on the host veth. */
  #address(index) {
    return {
      guest: `172.16.${index}.2`,
      prefix: 30,
      gateway: `172.16.${index}.1`
    }
  }

  /** Create the box's netns and veth pair; the guest end goes into the netns. */
  #network(record, index) {
    const ns = `box-${record.id}`
    const host = `veth-${record.id.slice(2, 8)}`
    const guest = `veth-${record.id.slice(2, 8)}g`
    const addr = this.#address(index)
    sh(['ip', 'netns', 'add', ns])
    sh(['ip', 'link', 'add', host, 'type', 'veth', 'peer', 'name', guest])
    sh(['ip', 'link', 'set', guest, 'netns', ns])
    sh(['ip', 'addr', 'add', `${addr.gateway}/30`, 'dev', host])
    sh(['ip', 'link', 'set', host, 'up'])
    sh(['ip', 'netns', 'exec', ns, 'ip', 'link', 'set', 'lo', 'up'])
    // The netns belongs to the VM's root, so root in a user namespace cannot
    // address it; the halo does, and actor-init finds it already right.
    const inside = ['ip', 'netns', 'exec', ns, 'ip']
    sh([...inside, 'addr', 'add', `${addr.guest}/${addr.prefix}`, 'dev', guest])
    sh([...inside, 'link', 'set', guest, 'up'])
    sh([...inside, 'route', 'replace', 'default', 'via', addr.gateway])
    sh(['sysctl', '-q', '-w', 'net.ipv4.ip_forward=1'])
    const blocked = [
      '10.0.0.0/8',
      '100.64.0.0/10',
      '127.0.0.0/8',
      '169.254.0.0/16',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '198.18.0.0/15',
      '224.0.0.0/4',
      '240.0.0.0/4'
    ]
    for (const range of blocked)
      this.#add_iptables(
        ['-C', 'FORWARD', '-i', host, '-d', range, '-j', 'DROP'],
        ['-A', 'FORWARD', '-i', host, '-d', range, '-j', 'DROP']
      )
    this.#add_iptables(
      ['-C', 'FORWARD', '-i', host, '-j', 'ACCEPT'],
      ['-A', 'FORWARD', '-i', host, '-j', 'ACCEPT']
    )
    this.#add_iptables(
      [
        '-C',
        'FORWARD',
        '-o',
        host,
        '-m',
        'conntrack',
        '--ctstate',
        'ESTABLISHED,RELATED',
        '-j',
        'ACCEPT'
      ],
      [
        '-A',
        'FORWARD',
        '-o',
        host,
        '-m',
        'conntrack',
        '--ctstate',
        'ESTABLISHED,RELATED',
        '-j',
        'ACCEPT'
      ]
    )
    this.#add_iptables(
      ['-C', 'FORWARD', '-o', host, '-j', 'DROP'],
      ['-A', 'FORWARD', '-o', host, '-j', 'DROP']
    )
    this.#add_iptables(
      [
        '-t',
        'nat',
        '-C',
        'POSTROUTING',
        '-s',
        `${addr.guest}/30`,
        '-j',
        'MASQUERADE'
      ],
      [
        '-t',
        'nat',
        '-A',
        'POSTROUTING',
        '-s',
        `${addr.guest}/30`,
        '-j',
        'MASQUERADE'
      ]
    )
    record.netns = ns
    record.host_veth = host
    record.address = addr
    return `/var/run/netns/${ns}`
  }

  #network_down(record) {
    if (record.netns) sh(['ip', 'netns', 'del', record.netns])
    if (record.host_veth) sh(['ip', 'link', 'del', record.host_veth])
  }

  /** Add an iptables rule if its check (-C) form is absent. */
  #add_iptables(check_argv, add_argv) {
    const present =
      sh(['iptables', ...check_argv], { check: false, stdio: 'ignore' })
        .status === 0
    if (!present) sh(['iptables', ...add_argv])
  }

  /**
   * Lowest free 172.16 index, 1..254. Mirrors the Firecracker tap scheme and
   * must avoid indexes the host already owns (live taps and other boxes), or
   * two interfaces claim the same gateway and replies blackhole.
   */
  #free_index() {
    const shown = sh(['ip', '-o', '-4', 'addr', 'show'], {
      check: false,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const used = new Set()
    for (const match of (shown.stdout ?? '').matchAll(
      /inet (\d+\.\d+\.(\d+)\.1)\/30/g
    ))
      if (match[1].startsWith('172.16.')) used.add(Number(match[2]))
    for (let i = 1; i <= 254; i++) if (!used.has(i)) return i
    throw new HaloError('no free box network index')
  }

  /**
   * `runc create` hands its stdio to the container, so a pipe would stay open
   * as long as the box runs; the box's output goes to its own log instead.
   */
  async #runc_create(record) {
    const log = open_sync(join(record.dir, 'box.log'), 'a')
    try {
      const child = spawn(
        this.runc_bin,
        ['create', '--bundle', record.dir, record.id],
        { stdio: ['ignore', log, log] }
      )
      const [code] = await once(child, 'exit')
      if (code !== 0) {
        const said = read_file_sync(join(record.dir, 'box.log'), 'utf8')
          .trim()
          .split('\n')
          .at(-1)
        throw new HaloError(
          `runc create ${record.id} exited ${code}: ${said ?? ''}`
        )
      }
    } finally {
      close_sync(log)
    }
  }

  runc(id, args) {
    return run(this.runc_bin, [...args, id], {
      timeout: this.api_timeout * 1000
    })
  }

  /** A writable bind; in a user namespace it is idmapped to the box's root. */
  #bind_rw(record) {
    return record.userns
      ? { options: ['bind', 'rw', 'idmap'], ...IDMAP }
      : { options: ['bind', 'rw'] }
  }

  /** The box's init pid on the VM, or 0 when runc cannot say. */
  async #runc_pid(id) {
    try {
      const { stdout } = await this.runc(id, ['state'])
      return JSON.parse(stdout).pid ?? 0
    } catch {
      return 0
    }
  }

  /** Overlay root over the read-only template; writable /realness and /run. */
  async #prepare(record, index) {
    const dir = join(this.volume, record.id)
    const base = join(dir, 'base')
    const box = this.box_dir(record.id)
    const realness = join(dir, 'realness')
    const etc = join(dir, 'etc')
    for (const d of [
      base,
      join(dir, 'root'),
      box,
      realness,
      etc,
      join(dir, 'upper'),
      join(dir, 'work')
    ])
      mkdir_sync(d, { recursive: true })
    // A host vault is virtiofs, which cannot be idmapped: the owner's own box
    // that mounts it keeps the VM's uids. Every other box gets a user namespace.
    record.userns = this.userns && !this.#vault_mounts(record).length
    const loop = record.userns ? join(dir, 'base-raw') : base
    mkdir_sync(loop, { recursive: true })
    await run('mount', ['-o', 'loop,ro', this.template, loop])
    if (record.userns) {
      // The template's root files show as the box's root, uid 100000 on the VM.
      await run('mount', [
        '--bind',
        '-o',
        `X-mount.idmap=b:0:${USERNS_BASE}:${USERNS_SIZE}`,
        loop,
        base
      ])
      await run('chown', [
        `${USERNS_BASE}:${USERNS_BASE}`,
        join(dir, 'upper'),
        join(dir, 'work')
      ])
    }
    if (!exists_sync(join(realness, 'AGENTS.md'))) {
      const seed = join(loop, 'realness')
      if (exists_sync(seed)) await run('cp', ['-a', `${seed}/.`, realness])
    }
    if (!exists_sync(join(etc, 'hostname')))
      await run('cp', ['-a', `${loop}/etc/.`, etc])
    await this.#owner_uid(record, etc, realness)

    await run('mount', [
      '-t',
      'overlay',
      'overlay',
      '-o',
      `lowerdir=${base},upperdir=${join(dir, 'upper')},workdir=${join(dir, 'work')}`,
      join(dir, 'root')
    ])
    record.dir = dir
    record.root = join(dir, 'root')
    record.realness = realness
    record.vsock_path = join(box, 'agent.sock')
    write_file_sync(join(box, 'responder.py'), HANDSHAKE_RESPONDER)
    for (const name of GUEST_COPIES) {
      const target = join(record.root, 'usr', 'local', 'bin', name)
      copy_file_sync(join(GUEST, name), target)
      chmod_sync(target, 0o755)
      if (record.userns) chown_sync(target, USERNS_BASE, USERNS_BASE)
    }
    const netns_path = this.#network(record, index)
    this.#write_config(record, netns_path)
  }

  /**
   * On the host vault, files belong to the machine's own user. The owner's
   * `realness` user takes that uid, so Pi writes notes the owner can edit.
   */
  async #owner_uid(record, etc, realness) {
    if (!this.#vault_mounts(record).length) return
    const { uid } = stat_sync(this.host_vault.path)
    const passwd = join(etc, 'passwd')
    const lines = read_file_sync(passwd, 'utf8').split('\n')
    const changed = lines.map(line => {
      const fields = line.split(':')
      if (fields[0] !== 'realness' || fields[2] === String(uid)) return line
      fields[2] = String(uid)
      return fields.join(':')
    })
    if (changed.join('\n') !== lines.join('\n'))
      write_file_sync(passwd, changed.join('\n'))
    if (stat_sync(realness).uid !== uid)
      await run('chown', ['-R', String(uid), realness])
  }

  /**
   * The owner's box works on this machine's vault itself, not a synced copy;
   * an empty folder covers its Sessions, which this machine indexes instead.
   */
  #vault_mounts(record) {
    const vault = this.host_vault
    if (!vault || record.owner !== vault.owner || !exists_sync(vault.path))
      return []
    return [
      {
        destination: '/realness/vault',
        type: 'none',
        source: vault.path,
        options: ['rbind', 'rw']
      },
      ...(exists_sync(join(vault.path, 'Sessions'))
        ? [
            {
              destination: '/realness/vault/Sessions',
              type: 'tmpfs',
              source: 'tmpfs',
              options: ['ro', 'nosuid', 'nodev', 'noexec', 'size=4k']
            }
          ]
        : [])
    ]
  }

  #write_config(record, netns_path) {
    const box = this.box_dir(record.id)
    const config = {
      ociVersion: '1.0.2',
      process: {
        terminal: false,
        user: { uid: 0, gid: 0 },
        args: [
          '/bin/bash',
          '-lc',
          'rm -f /box/agent.sock /box/pty.sock /box/chat.sock /box/sock-52 /box/sock-53 /box/sock-55; ' +
            'mkdir -p /run/realness && chown realness:realness /run/realness && chmod 755 /run/realness; ' +
            'socat UNIX-LISTEN:/run/realness/door.sock,fork,reuseaddr,mode=666 UNIX-CONNECT:/box/sock-52_54 & ' +
            'socat UNIX-LISTEN:/box/agent.sock,fork,reuseaddr EXEC:/usr/local/bin/realness-agent & ' +
            'socat UNIX-LISTEN:/box/pty.sock,fork,reuseaddr EXEC:/usr/local/bin/realness-pty & ' +
            'socat UNIX-LISTEN:/box/chat.sock,fork,reuseaddr EXEC:/usr/local/bin/realness-chat & ' +
            'python3 /box/responder.py & ' +
            'trap "kill %1 %2 %3 %4 %5" TERM INT; wait'
        ],
        env: [
          'PATH=/usr/local/bin:/usr/bin:/bin',
          'HOME=/root',
          'TERM=xterm',
          'USER=root'
        ],
        cwd: '/',
        capabilities: Object.fromEntries(
          ['bounding', 'effective', 'permitted', 'inheritable', 'ambient'].map(
            k => [k, CAPS]
          )
        ),
        noNewPrivileges: false
      },
      root: { path: record.root, readonly: true },
      hostname: `box-${record.id}`,
      mounts: [
        { destination: '/proc', type: 'proc', source: 'proc' },
        {
          destination: '/dev',
          type: 'tmpfs',
          source: 'tmpfs',
          options: ['nosuid', 'strictatime', 'mode=755', 'size=65536k']
        },
        {
          destination: '/dev/pts',
          type: 'devpts',
          source: 'devpts',
          options: [
            'nosuid',
            'noexec',
            'newinstance',
            'ptmxmode=0666',
            'mode=0620',
            'gid=5'
          ]
        },
        {
          destination: '/dev/shm',
          type: 'tmpfs',
          source: 'shm',
          options: ['nosuid', 'noexec', 'nodev', 'mode=1777', 'size=65536k']
        },
        {
          destination: '/dev/mqueue',
          type: 'mqueue',
          source: 'mqueue',
          options: ['nosuid', 'noexec', 'nodev']
        },
        // sysfs cannot be mounted fresh from a user namespace that does not
        // own the netns; a read-only bind of the VM's shows the same.
        record.userns
          ? {
              destination: '/sys',
              type: 'none',
              source: '/sys',
              options: ['rbind', 'nosuid', 'noexec', 'nodev', 'ro']
            }
          : {
              destination: '/sys',
              type: 'sysfs',
              source: 'sysfs',
              options: ['nosuid', 'noexec', 'nodev', 'ro']
            },
        {
          destination: '/run',
          type: 'tmpfs',
          source: 'tmpfs',
          options: ['rw', 'nosuid', 'nodev', 'mode=755']
        },
        {
          destination: '/etc',
          type: 'none',
          source: join(record.dir, 'etc'),
          ...this.#bind_rw(record)
        },
        {
          destination: '/realness',
          type: 'none',
          source: record.realness,
          ...this.#bind_rw(record)
        },
        ...this.#vault_mounts(record),
        {
          destination: '/usr/local/lib/realness',
          type: 'none',
          source: REALNESS_LIB,
          options: ['bind', 'ro']
        },
        {
          destination: '/box',
          type: 'none',
          source: box,
          ...this.#bind_rw(record)
        }
      ],
      linux: {
        resources: {
          devices: [{ allow: false, access: 'rwm' }],
          memory: {
            limit: this.mib * MIB,
            swap: this.mib * MIB
          },
          cpu: { quota: this.cpus * CPU_PERIOD, period: CPU_PERIOD },
          pids: { limit: this.pids }
        },
        ...(record.userns
          ? { uidMappings: USERNS_MAP, gidMappings: USERNS_MAP }
          : {}),
        namespaces: [
          ...(record.userns ? [{ type: 'user' }] : []),
          { type: 'pid' },
          { type: 'network', path: netns_path },
          { type: 'ipc' },
          { type: 'uts' },
          { type: 'mount' }
        ]
      }
    }
    write_json(join(record.dir, 'config.json'), config)
  }

  async #boot(record) {
    await this.#prepare(record, this.#free_index())
    await this.#runc_create(record)
    await this.runc(record.id, ['start'])
    record.pid = await this.#runc_pid(record.id)
    record.state = 'running'
    record.vsock_path = join(this.box_dir(record.id), 'sock-52')
    record.pty_path = join(this.box_dir(record.id), 'sock-53')
  }

  async create(owner, { paths = null, startup: progress = null } = {}) {
    if (this.closed) throw new HaloError('the halo is parking')
    if (!/^\+[1-9]\d{6,14}$/.test(owner))
      throw new BadRequest('verified owner required')
    const id = mint_id()
    const startup = this.#startup(id, progress ?? {})
    const record = new Actor({
      id,
      startup,
      created: now_iso(),
      owner,
      paths,
      last_activity: now_iso(),
      state: 'stopped'
    })
    this.creating.add(id)
    try {
      await this.#boot(record)
      await vsock.wait_for_agent(
        record.vsock_path,
        this.boot_timeout,
        this.vsock_port
      )
      await this.#init_actor(record, {
        pi_after_recovery: Boolean(this.sync_url)
      })
      this.#write(record)
    } catch (error) {
      await this.#teardown(record)
      throw error
    } finally {
      this.creating.delete(id)
    }
    await this.#recover(record, startup)
    if (!this.sync_url) await this.#start_pi(record, startup)
    this.trace(id, 'create', { hostname: record.hostname })
    return record
  }

  /** k1: a new box pulls its owner's work back from sync before first use. */
  async #recover(record, startup) {
    if (!this.sync_url) return
    const started = Date.now()
    try {
      const { code, out, err } = await startup.run(
        'restoring_files',
        async () => {
          if (!(await wait_for_door(record.vsock_path)))
            LOG.warn(`actor ${record.id} door not open before recovery`)
          const pass = issue_recovery_pass(
            {
              phone: record.owner,
              id: record.id,
              paths: record.paths ?? null,
              ...halo_claim()
            },
            halo_pass_secret()
          )
          const result = await vsock.exec_in_guest(
            record.vsock_path,
            [
              '/usr/bin/env',
              `REALNESS_RECOVERY_PASS=${pass}`,
              ...(this.#vault_mounts(record).length
                ? ['REALNESS_KEEP_LOCAL=vault']
                : []),
              '/usr/local/bin/realness-recover',
              this.sync_url
            ],
            { timeout: RECOVER_SECONDS, port: this.vsock_port }
          )
          await this.#flush(record)
          return result
        },
        { succeeded: result => result.code === 0 }
      )
      this.trace(record.id, 'recover', {
        exit_code: code,
        ms: Date.now() - started,
        out: out.toString().trim().slice(-200),
        err: err.toString().trim().slice(-200)
      })
      if (code !== 0)
        LOG.warn(
          `actor ${record.id} recovery exited ${code}: ${err.toString().trim().slice(-200)}`
        )
    } catch (error) {
      LOG.error(`actor ${record.id} recovery threw`, error)
    }
    await this.#start_pi(record, startup)
  }

  /**
   * The box types the opener on its terminal, as the page would. The guest's
   * own `start-pi` cannot reach the holder from a box, so this loop retypes it
   * while neither Pi nor its launcher runs, until Pi stays up across two checks.
   */
  async #start_pi(record, startup) {
    const started = await startup.run(
      'starting_pi',
      () => this.#type_until_pi(record),
      { succeeded: up => up }
    )
    if (!started) throw new HaloError('Pi did not start in the terminal')
  }

  async #type_until_pi(record) {
    const deadline = Date.now() + this.boot_timeout * 1000
    let typed = 0
    while (Date.now() < deadline) {
      const { out } = await vsock
        .exec_in_guest(record.vsock_path, ['/bin/sh', '-c', PI_STATE], {
          timeout: this.api_timeout,
          port: this.vsock_port
        })
        .catch(() => ({ out: Buffer.alloc(0) }))
      const state = out.toString().trim()
      if (state === 'pi') return true
      if (state === 'none' && Date.now() - typed > OPENER_RETRY_MS) {
        await this.#type_opener(record).catch(() => {})
        typed = Date.now()
      }
      await sleep(PI_POLL_MS)
    }
    return false
  }

  async #type_opener(record) {
    const pty = await vsock.connect(record.pty_path, 53)
    const frame = {
      op: 'data',
      data_b64: Buffer.from('realness\r').toString('base64')
    }
    await new Promise(done => {
      pty.socket.write(`${JSON.stringify(frame)}\n`, done)
    })
    pty.socket.destroy()
  }

  async #init_actor(record, { pi_after_recovery = false } = {}) {
    const addr = record.address
    const { code, err } = await vsock.exec_in_guest(
      record.vsock_path,
      [
        ACTOR_INIT,
        record.id,
        String(Math.floor(Date.now() / 1000)),
        `${addr.guest}/${addr.prefix}`,
        ...(pi_after_recovery ? ['--after-recovery'] : [])
      ],
      { timeout: this.boot_timeout, port: this.vsock_port }
    )
    if (code !== 0)
      throw new HaloError(
        `actor-init on ${record.id} exited ${code}: ${err.toString().trim()}`
      )
    const identity = await this.identity(record.vsock_path)
    Object.assign(record, identity)
  }

  async identity(uds) {
    const output = await vsock.run_ok(
      uds,
      [
        '/bin/sh',
        '-c',
        'printf "%s %s %s\\n" "$(cat /etc/machine-id)" "$(hostname)" "$(cat /proc/sys/kernel/random/boot_id)"'
      ],
      { timeout: this.api_timeout, port: this.vsock_port }
    )
    const [machine_id, hostname, boot_id] = output.trim().split(/\s+/)
    return { machine_id, hostname, boot_id }
  }

  #startup(id, progress = {}) {
    return create_startup_trace({
      id: progress.id ?? random_uuid(),
      started_at: progress.started_at,
      clock: () => performance.now(),
      report: fields => {
        this.trace(id, 'startup-stage', fields)
        progress.report?.({ ...fields, actor_id: id })
      }
    })
  }

  async ensure_running(id) {
    const record = this.get(id)
    if (record.state !== 'stopped') {
      const running = await this.runc(id, ['state'])
        .then(({ stdout }) => JSON.parse(stdout).status === 'running')
        .catch(() => false)
      if (!running) {
        record.state = 'stopped'
        this.#write(record)
      }
    }
    if (record.state !== 'running') await this.reload(id)
    return this.get(id)
  }

  async exec(
    id,
    argv,
    { cwd = null, stdin = Buffer.alloc(0), timeout = null } = {}
  ) {
    const record = await this.ensure_running(id)
    const started = Date.now()
    const work = `exec:${random_uuid()}`
    this.begin_work(id, work)
    try {
      const { code, out, err } = await vsock.exec_in_guest(
        record.vsock_path,
        argv,
        {
          cwd,
          stdin,
          timeout: timeout || this.api_timeout,
          port: this.vsock_port
        }
      )
      await this.#flush(record)
      this.trace(record.id, 'exec', {
        argv,
        exit_code: code,
        ms: Date.now() - started
      })
      return {
        exit_code: code,
        stdout_b64: out.toString('base64'),
        stderr_b64: err.toString('base64')
      }
    } finally {
      this.end_work(id, work)
    }
  }

  async exec_stream(id, argv, options = {}) {
    const record = await this.ensure_running(id)
    const work = `exec:${random_uuid()}`
    this.begin_work(id, work)
    try {
      const result = await vsock.exec_in_guest_stream(record.vsock_path, argv, {
        timeout: options.timeout ?? this.api_timeout,
        port: this.vsock_port,
        signal: options.signal,
        on_output: options.on_output,
        cwd: options.cwd ?? null,
        stdin: options.stdin ?? Buffer.alloc(0),
        env: options.env,
        inherit_env: options.inherit_env,
        spill: options.spill
      })
      return {
        exit_code: result.code,
        ...(result.error ? { error: result.error } : {})
      }
    } finally {
      this.end_work(id, work)
    }
  }

  async #flush(record) {
    try {
      await vsock.run_ok(record.vsock_path, ['/bin/sync'], {
        timeout: this.api_timeout,
        port: this.vsock_port
      })
    } catch {}
  }

  async flush_all() {
    await Promise.all(this.live_actors().map(record => this.#flush(record)))
  }

  begin_work(id, key = 'work') {
    const held = this.busy.get(id) ?? new Set()
    held.add(key)
    this.busy.set(id, held)
  }

  end_work(id, key = 'work') {
    const held = this.busy.get(id)
    if (!held?.delete(key)) return
    if (!held.size) this.busy.delete(id)
    this.touch(id).catch(() => {})
  }

  is_busy(id) {
    return this.busy.has(id)
  }

  activity() {
    const kinds = {}
    for (const held of this.busy.values())
      for (const key of held) {
        const [kind] = key.split(':')
        kinds[kind] = (kinds[kind] ?? 0) + 1
      }
    return { actors: this.busy.size, kinds }
  }

  touch(id) {
    return this.lock.run(() => {
      const record = this.get(id)
      record.last_activity = now_iso()
      this.#write(record)
      return record
    })
  }

  park() {
    this.closed = true
    return this.lock.run(async () => {
      for (const record of this.live_actors()) {
        if (this.is_busy(record.id))
          return { ok: false, reason: `${record.id} is busy` }
        await this.#idle(record.id, 'disk')
      }
      return { ok: true }
    })
  }

  reopen() {
    this.closed = false
  }

  /**
   * Box tiers: memory keeps the box running (the warm tier), disk destroys it.
   * Retire and export mirror the Firecracker lifecycle: a box is removed once
   * its export is written. A directory with no actor.json and no create in
   * flight is a create that died; its mounts and files go.
   */
  sweep({ now = Date.now() } = {}) {
    return this.lock.run(async () => {
      const done = []
      for (const id of this.incomplete()) {
        if (this.creating?.has(id)) continue
        LOG.warn(`removing incomplete box directory: ${id}`)
        await this.#teardown({ id, dir: join(this.volume, id) })
        done.push({ id, step: 'remove' })
      }
      for (const record of this.list()) {
        if (this.is_busy(record.id)) continue
        const step = next_step(record, now, { synced: Boolean(this.sync_url) })
        if (!step) continue
        if (record.state !== 'stopped' && (await this.keeps_awake(record)))
          continue
        if (step === 'memory') await this.#idle(record.id, 'memory')
        else if (step === 'disk') await this.#idle(record.id, 'disk')
        else if (step === 'retire') await this.#destroy(record.id)
        else if (step === 'export') {
          await this.export(record.id)
          await this.#teardown(record)
        } else continue
        done.push({ id: record.id, step })
      }
      return done
    })
  }

  /** A pane running a job keeps the box awake: its activity is now. */
  async keeps_awake(record) {
    const busy = await sessions_busy(record, this.vsock_port)
    if (!busy.length) return false
    record.last_activity = now_iso()
    this.#write(record)
    LOG.info(`actor ${record.id} kept awake by ${busy.join(', ')}`)
    return true
  }

  /** memory keeps the box alive; disk destroys it. Work lives in the harness/sync. */
  idle(id, tier = 'memory') {
    return this.lock.run(() => this.#idle(id, tier))
  }

  async #idle(id, tier) {
    if (tier !== 'memory' && tier !== 'disk')
      throw new BadRequest(
        `unknown idle tier '${tier}'; expected memory or disk`
      )
    const record = this.get(id)
    if (record.state === 'running' || record.state === 'idle') {
      await this.#flush(record)
      if (tier === 'disk') {
        await this.runc(id, ['kill', 'KILL']).catch(() => {})
        await this.runc(id, ['delete', '--force']).catch(() => {})
      }
      record.state = tier === 'disk' ? 'stopped' : 'idle'
      this.#write(record)
    }
    this.trace(id, 'idle', { tier })
    LOG.info(`actor ${id} idle (${tier} tier)`)
    return this.get(id)
  }

  reload(id) {
    return this.lock.run(() => this.#reload(id))
  }

  async #reload(id) {
    const record = this.get(id)
    // Right after a hard stop the init can still look alive; only an agent
    // that answers is a running box.
    if (record.state === 'running' && (await this.#answers(record)))
      return record
    record.last_activity = now_iso()
    if (record.state === 'idle') {
      record.state = 'running'
      this.#write(record)
      this.trace(id, 'reload', { from_memory: true })
      return record
    }
    await this.#release_runtime(record)
    await this.#boot(record)
    await vsock.wait_for_agent(
      record.vsock_path,
      this.boot_timeout,
      this.vsock_port
    )
    await this.#init_actor(record, { pi_after_recovery: true })
    this.#write(record)
    await this.#start_pi(record, this.#startup(id))
    this.trace(id, 'reload', { from_memory: false })
    return this.get(id)
  }

  async #answers(record) {
    try {
      await vsock.wait_for_agent(record.vsock_path, 2, this.vsock_port)
      return true
    } catch {
      return false
    }
  }

  destroy(id) {
    return this.lock.run(() => this.#destroy(id))
  }

  async #destroy(id) {
    const record = this.get(id)
    await this.#teardown(record)
    return record
  }

  async #release_runtime(record) {
    await this.runc(record.id, ['kill', 'KILL']).catch(() => {})
    await this.runc(record.id, ['delete', '--force']).catch(() => {})
    this.#network_down(record)
    await run('umount', ['-l', join(record.dir, 'root')]).catch(() => {})
    await run('umount', ['-l', join(record.dir, 'base')]).catch(() => {})
    await run('umount', ['-l', join(record.dir, 'base-raw')]).catch(() => {})
  }

  async #teardown(record) {
    await this.#release_runtime(record)
    const dir = join(this.volume, record.id)
    rm_sync(dir, { recursive: true, force: true })
    rm_sync(join(this.published_dir, record.id), {
      recursive: true,
      force: true
    })
    rm_sync(join(this.versions_dir, record.id), {
      recursive: true,
      force: true
    })
  }

  #write(record) {
    write_json(join(this.volume, record.id, 'actor.json'), record.stored())
  }

  /** A box whose init died (a hard stop, a VM restart) reads as stopped. */
  get(id) {
    if (!ID.test(id)) throw new NotFound(id)
    const path = join(this.volume, id, 'actor.json')
    if (!exists_sync(path)) throw new NotFound(id)
    const record = new Actor(JSON.parse(read_file_sync(path, 'utf8')))
    if (record.state !== 'stopped' && record.pid && !alive(record.pid))
      record.state = 'stopped'
    return record
  }

  owner_of(id) {
    return this.get(id).owner
  }

  list() {
    if (!exists_sync(this.volume)) return []
    return readdir_sync(this.volume, { withFileTypes: true })
      .filter(
        entry =>
          entry.isDirectory() &&
          !NON_ACTOR_DIRS.has(entry.name) &&
          ID.test(entry.name)
      )
      .filter(entry => exists_sync(join(this.volume, entry.name, 'actor.json')))
      .map(entry => this.get(entry.name))
  }

  /** Actor directories that have no actor.json. */
  incomplete() {
    if (!exists_sync(this.volume)) return []
    return readdir_sync(this.volume, { withFileTypes: true })
      .filter(
        entry =>
          entry.isDirectory() &&
          !NON_ACTOR_DIRS.has(entry.name) &&
          MINTED.test(entry.name) &&
          !exists_sync(join(this.volume, entry.name, 'actor.json'))
      )
      .map(entry => entry.name)
  }

  live_actors() {
    return this.list().filter(record => record.state === 'running')
  }

  #trace_path(id) {
    return join(this.traces_dir, `${id}.jsonl`)
  }

  trace(id, event, fields = {}) {
    const line = Object.fromEntries(
      Object.entries({ ts: now_iso(), event, ...fields }).sort(([a], [b]) =>
        a < b ? -1 : 1
      )
    )
    try {
      mkdir_sync(this.traces_dir, { recursive: true })
      append_file_sync(this.#trace_path(id), `${JSON.stringify(line)}\n`)
    } catch {}
  }

  trace_of(id, limit) {
    const path = this.#trace_path(id)
    if (!exists_sync(path)) return []
    const events = read_file_sync(path, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
    return limit ? events.slice(-limit) : events
  }

  first_turn(id, now = Date.now()) {
    if (this.turned.has(id)) return null
    this.turned.add(id)
    if (this.trace_of(id).some(row => row.event === 'first-turn')) return null
    const created = Date.parse(this.get(id).created)
    const ms = Number.isFinite(created) ? now - created : null
    this.trace(id, 'first-turn', ms === null ? {} : { ms })
    return ms
  }

  async receive_log(id, log) {
    await this.ensure_running(id)
    const bytes = Buffer.from(JSON.stringify(log), 'utf8')
    const digest = create_hash('sha256').update(bytes).digest('hex')
    const snapshot = `${HANDSOVER}.${digest}`
    const result = await this.exec(
      id,
      [
        'sh',
        '-c',
        `mkdir -p $(dirname ${HANDSOVER}) && tee ${snapshot} >/dev/null && ln -sfn ${snapshot} ${HANDSOVER}.next && mv -Tf ${HANDSOVER}.next ${HANDSOVER}`
      ],
      { stdin: bytes }
    )
    if (result.exit_code !== 0)
      throw new BadRequest('could not leave the session log')
    return { written: true }
  }

  /** execFile has no `input`; tar reads the archive from stdin here. */
  async copy_out(id, tree, dest) {
    if (
      typeof tree !== 'string' ||
      !tree.startsWith('/') ||
      tree.split('/').includes('..')
    )
      throw new BadRequest('path must be absolute, with no .. segments')
    const result = await this.exec(id, ['tar', '-czf', '-', '-C', tree, '.'])
    if (result.exit_code !== 0)
      throw new BadRequest(`nothing to copy at ${tree}`)
    rm_sync(dest, { recursive: true, force: true })
    mkdir_sync(dest, { recursive: true })
    const untar = spawn_sync(
      'tar',
      ['-xzf', '-', '-C', dest, '--no-same-owner', '--no-same-permissions'],
      { input: Buffer.from(result.stdout_b64, 'base64') }
    )
    if (untar.status !== 0) {
      rm_sync(dest, { recursive: true, force: true })
      throw new HaloError(`could not unpack ${tree}: ${untar.stderr}`)
    }
  }

  publish(id, tree = '/realness/site', _site = id) {
    return this.publishing.run(async () => {
      const target = join(this.published_dir, id)
      const staging = join(this.published_dir, `.${id}.part`)
      await this.copy_out(id, tree, staging)
      rm_sync(target, { recursive: true, force: true })
      rename_sync(staging, target)
      const files = list_files(target)
      const published = {
        id,
        path: tree,
        files: files.length,
        bytes: files.reduce((sum, file) => sum + stat_sync(file).size, 0),
        url: `/s/${id}/`
      }
      this.trace(id, 'publish', published)
      return published
    })
  }

  published_site(id) {
    if (!ID.test(id)) return null
    const root = join(this.published_dir, id)
    return exists_sync(root) && stat_sync(root).isDirectory() ? root : null
  }

  seed_status() {
    return { built: exists_sync(this.template), matches: true, mismatches: [] }
  }

  /** Boxes use the template rootfs directly; there is no reflink to warn about. */
  reflink_warning() {
    return null
  }

  ensure_seed() {
    return Promise.resolve(this.seed_status())
  }

  exports() {
    if (!exists_sync(this.exports_dir)) return []
    return readdir_sync(this.exports_dir)
      .filter(name =>
        exists_sync(join(this.exports_dir, name, 'manifest.json'))
      )
      .map(name =>
        JSON.parse(
          read_file_sync(join(this.exports_dir, name, 'manifest.json'), 'utf8')
        )
      )
  }

  /** Export tars the actor's harness dir - no disk to mount. */
  async export(id) {
    const record = this.get(id)
    await this.#idle(id, 'disk')
    const target = join(this.exports_dir, id)
    const staging = join(this.exports_dir, `.${id}.part`)
    rm_sync(staging, { recursive: true, force: true })
    mkdir_sync(staging, { recursive: true })
    const artifacts = join(staging, 'artifacts.tar.gz')
    await run('tar', ['-czf', artifacts, '-C', record.dir, ...ARTIFACT_PATHS])
    const trace_path = this.#trace_path(id)
    const trace_text = exists_sync(trace_path)
      ? read_file_sync(trace_path, 'utf8')
      : ''
    write_file_sync(join(staging, 'trace.jsonl'), trace_text)
    const manifest = {
      schema: 1,
      id,
      exported: now_iso(),
      actor: {
        id: record.id,
        created: record.created,
        machine_id: record.machine_id,
        hostname: record.hostname,
        owner: record.owner
      },
      artifacts: {
        path: 'artifacts.tar.gz',
        bytes: stat_sync(artifacts).size,
        sha256: sha256_file(artifacts),
        paths: ARTIFACT_PATHS
      },
      trace: { path: 'trace.jsonl', bytes: Buffer.byteLength(trace_text) }
    }
    write_json(join(staging, 'manifest.json'), manifest)
    rm_sync(target, { recursive: true, force: true })
    rename_sync(staging, target)
    this.trace(id, 'export')
    return manifest
  }

  /** A new box with the export's files and trace; another owner's export is a 404. */
  async restore(export_id, owner, { start = true } = {}) {
    const export_dir = join(this.exports_dir, export_id)
    const manifest_path = join(export_dir, 'manifest.json')
    if (!ID.test(export_id) || !exists_sync(manifest_path))
      throw new NotFound(`export ${export_id}`)
    const manifest = JSON.parse(read_file_sync(manifest_path, 'utf8'))
    if (!manifest.actor?.owner || manifest.actor.owner !== owner)
      throw new NotFound(`export ${export_id}`)
    const artifacts = join(export_dir, manifest.artifacts.path)
    const digest = sha256_file(artifacts)
    if (manifest.artifacts.sha256 && digest !== manifest.artifacts.sha256)
      throw new BadRequest(`export ${export_id} is corrupt`)
    const record = await this.create(owner)
    try {
      await this.lock.run(async () => {
        await this.#idle(record.id, 'disk')
        const old = manifest.artifacts.paths ? record.dir : record.realness
        await run('tar', ['-xzf', artifacts, '-C', old, '--no-same-owner'])
        const exported_trace = join(export_dir, 'trace.jsonl')
        if (exists_sync(exported_trace)) {
          const trace_path = this.#trace_path(record.id)
          const current = exists_sync(trace_path)
            ? read_file_sync(trace_path, 'utf8')
            : ''
          write_file_sync(
            trace_path,
            read_file_sync(exported_trace, 'utf8') + current
          )
        }
        this.trace(record.id, 'restore', {
          source: export_id,
          artifacts_sha256: digest
        })
        if (start) await this.#reload(record.id)
      })
    } catch (error) {
      LOG.warn(`restore of ${export_id} failed, rolling back`)
      await this.destroy(record.id).catch(() => {})
      throw error
    }
    LOG.info(`actor ${record.id} restored from ${export_id}`)
    return this.get(record.id)
  }

  site_versions() {
    return []
  }

  restore_site() {
    throw new NotFound('no site versions')
  }

  unpublish_site() {
    throw new NotFound('no site')
  }

  save_site() {
    return null
  }
}
