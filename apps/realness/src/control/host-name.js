/**
 * lc3: a name per host, kept current. Each host keeps `<host>.realness.online`
 * and `*.<host>.realness.online` pointed at its own address through the
 * Cloudflare API (DNS only, never 127.0.0.1), and holds a Let's Encrypt
 * wildcard for them, renewed through the same token by DNS-01.
 */
import { execFileSync as exec_file_sync } from 'node:child_process'
import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { networkInterfaces as network_interfaces } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { secret_path } from '#root/src/settings/secrets.js'
import { local_settings } from '#root/src/settings/environments.js'

const ZONE = 'realness.online'
const API = 'https://api.cloudflare.com/client/v4'
const TTL_S = 60
/** Renew when fewer days than this remain. */
const RENEW_DAYS = 30
const DAY_MS = 86_400_000
/** Time for a new TXT record to reach Let's Encrypt's resolvers. */
const PROPAGATE_MS = 20_000
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/

/** This host's label: REALNESS_HOST, else the local settings' host, else the Mac's LocalHostName. */
export const host_label = (env = process.env) => {
  let name = env.REALNESS_HOST ?? local_settings.host
  if (!name)
    try {
      name = exec_file_sync('scutil', ['--get', 'LocalHostName'], {
        encoding: 'utf8'
      })
    } catch {
      name = exec_file_sync('hostname', ['-s'], { encoding: 'utf8' })
    }
  const label = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!LABEL.test(label)) throw new Error(`not a usable host name: ${name}`)
  return label
}

/** The host's LAN IPv4: the first non-internal address, preferring en0. */
const lan_address = (interfaces = network_interfaces()) => {
  const rest = Object.keys(interfaces)
    .filter(name => name !== 'en0')
    .sort()
  const names = ['en0', ...rest]
  for (const name of names)
    for (const entry of interfaces[name] ?? [])
      if (entry.family === 'IPv4' && !entry.internal) return entry.address
  throw new Error('no LAN address')
}

/** The names a host owns. */
export const host_names = host => ({
  base: `${host}.${ZONE}`,
  wildcard: `*.${host}.${ZONE}`,
  /** The app answers at the host's own name. */
  app: `${host}.${ZONE}`
})

/** Where a host keeps its certificate; beside the other local secrets. */
export const cert_paths = host => {
  const dir = secret_path(join('certs', host))
  return {
    dir,
    key: join(dir, 'key.pem'),
    cert: join(dir, 'cert.pem'),
    account: secret_path(join('certs', 'acme-account.pem'))
  }
}

const read_token = () => {
  const file = secret_path('cloudflare-token')
  if (!exists_sync(file))
    throw new Error(
      `no Cloudflare token; save one (Edit zone DNS, ${ZONE} only) to ${file}`
    )
  return read_file_sync(file, 'utf8').trim()
}

/** A small Cloudflare DNS client for one zone. */
const cloudflare = (token, fetcher = fetch) => {
  const call = async (method, path, body) => {
    const response = await fetcher(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      ...(body && { body: JSON.stringify(body) })
    })
    const json = await response.json()
    if (!json.success)
      throw new Error(
        `cloudflare ${method} ${path}: ${json.errors?.map(e => e.message).join('; ') || response.status}`
      )
    return json.result
  }
  let zone_id = null
  const zone = async () => {
    if (zone_id) return zone_id
    const [found] = await call('GET', `/zones?name=${ZONE}`)
    if (!found) throw new Error(`the token cannot see ${ZONE}`)
    zone_id = found.id
    return zone_id
  }
  const records = async (type, name) =>
    call(
      'GET',
      `/zones/${await zone()}/dns_records?type=${type}&name=${encodeURIComponent(name)}`
    )
  return {
    records,
    /** Make `name` answer exactly `content`; returns what changed. */
    async upsert(type, name, content) {
      const [current, ...extra] = await records(type, name)
      const want = { type, name, content, ttl: TTL_S, proxied: false }
      const zone_id = await zone()
      await Promise.all(
        extra.map(record =>
          call('DELETE', `/zones/${zone_id}/dns_records/${record.id}`)
        )
      )
      if (!current) {
        await call('POST', `/zones/${await zone()}/dns_records`, want)
        return 'created'
      }
      if (current.content === content && current.proxied === false)
        return 'unchanged'
      await call(
        'PUT',
        `/zones/${await zone()}/dns_records/${current.id}`,
        want
      )
      return 'updated'
    },
    async add_txt(name, content) {
      return call('POST', `/zones/${await zone()}/dns_records`, {
        type: 'TXT',
        name,
        content,
        ttl: TTL_S
      })
    },
    async remove(record) {
      await call('DELETE', `/zones/${await zone()}/dns_records/${record.id}`)
    }
  }
}

/** Point this host's names at its address. */
const update_records = async ({ dns, host, address }) => {
  const { base, wildcard } = host_names(host)
  return {
    [base]: await dns.upsert('A', base, address),
    [wildcard]: await dns.upsert('A', wildcard, address)
  }
}

/** Days left on a PEM certificate, or -1 when there is none. */
const days_left = async (file, now = Date.now()) => {
  if (!exists_sync(file)) return -1
  const { X509Certificate } = await import('node:crypto')
  const cert = new X509Certificate(read_file_sync(file))
  return Math.floor((Date.parse(cert.validTo) - now) / DAY_MS)
}

/**
 * Get or renew the host's wildcard from Let's Encrypt by DNS-01.
 * @param {{ dns: ReturnType<typeof cloudflare>, host: string, email?: string, staging?: boolean, log?: (line: string) => void }} options
 * @returns {Promise<{ renewed: boolean, days_left: number }>}
 */
const ensure_certificate = async ({
  dns,
  host,
  email,
  staging = false,
  log = () => {}
}) => {
  const paths = cert_paths(host)
  const left = await days_left(paths.cert)
  if (left >= RENEW_DAYS) return { renewed: false, days_left: left }
  const { default: acme } = await import('acme-client')
  mkdir_sync(paths.dir, { recursive: true, mode: 0o700 })
  if (!exists_sync(paths.account))
    write_file_sync(paths.account, await acme.crypto.createPrivateKey(), {
      mode: 0o600
    })
  const client = new acme.Client({
    directoryUrl: staging
      ? acme.directory.letsencrypt.staging
      : acme.directory.letsencrypt.production,
    accountKey: read_file_sync(paths.account)
  })
  const { base, wildcard } = host_names(host)
  const [key, csr] = await acme.crypto.createCsr({
    commonName: wildcard,
    altNames: [wildcard, base]
  })
  const added = []
  const cert = await client.auto({
    csr,
    email,
    termsOfServiceAgreed: true,
    challengePriority: ['dns-01'],
    challengeCreateFn: async (authz, _challenge, value) => {
      const name = `_acme-challenge.${authz.identifier.value}`
      log(`dns-01: ${name}`)
      added.push(await dns.add_txt(name, value))
      await delay(PROPAGATE_MS)
    },
    challengeRemoveFn: async () => {
      await Promise.all(added.splice(0).map(record => dns.remove(record)))
    }
  })
  write_file_sync(paths.key, key, { mode: 0o600 })
  write_file_sync(paths.cert, cert, { mode: 0o600 })
  return { renewed: true, days_left: await days_left(paths.cert) }
}

/**
 * One pass: records follow the address, then the certificate renews if due.
 * Without a token, says what is missing and changes nothing.
 * @param {{ env?: NodeJS.ProcessEnv, cert?: boolean, log?: (line: string) => void }} [options]
 */
export const keep_host_name = async ({
  env = process.env,
  cert = true,
  log = () => {}
} = {}) => {
  const host = host_label(env)
  const address = lan_address()
  const dns = cloudflare(read_token())
  const records = await update_records({ dns, host, address })
  const certificate = cert
    ? await ensure_certificate({
        dns,
        host,
        email: env.REALNESS_ACME_EMAIL,
        staging: env.REALNESS_ACME_STAGING === '1',
        log
      })
    : null
  return { host, address, records, certificate, ...host_names(host) }
}
