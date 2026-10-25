import { run } from './syscalls.js'
import { DEVTOOLS_PORT } from './chrome-pool.js'
import { logger } from './log.js'
import { MS_PER_MINUTE } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- leases return one at a time so each copy is freed before the next */

const LOG = logger('chrome-leases')
const LEASE_MINUTES = 30
const CHAIN = 'REALNESS-LEASE'

/** The iptables rule bodies for one lease, actor and copy as addresses. Pure. */
export const lease_rules = (actor, copy) => [
  [
    '-s',
    actor,
    '-d',
    copy,
    '-p',
    'tcp',
    '--dport',
    String(DEVTOOLS_PORT),
    '-m',
    'conntrack',
    '--ctstate',
    'NEW,ESTABLISHED',
    '-j',
    'ACCEPT'
  ],
  [
    '-s',
    copy,
    '-d',
    actor,
    '-p',
    'tcp',
    '-m',
    'conntrack',
    '--ctstate',
    'NEW,ESTABLISHED',
    '-j',
    'ACCEPT'
  ],
  [
    '-s',
    copy,
    '-d',
    actor,
    '-p',
    'tcp',
    '--sport',
    String(DEVTOOLS_PORT),
    '-m',
    'conntrack',
    '--ctstate',
    'ESTABLISHED',
    '-j',
    'ACCEPT'
  ],
  [
    '-s',
    actor,
    '-d',
    copy,
    '-p',
    'tcp',
    '-m',
    'conntrack',
    '--ctstate',
    'ESTABLISHED',
    '-j',
    'ACCEPT'
  ]
]

const iptables_firewall = {
  open: (actor, copy) => {
    for (const rule of lease_rules(actor, copy))
      run(['iptables', '-A', CHAIN, ...rule])
  },
  close: (actor, copy) => {
    for (const rule of lease_rules(actor, copy))
      while (
        run(['iptables', '-D', CHAIN, ...rule], { check: false }).code === 0
      );
  }
}

/**
 * One handed-out Chrome copy. `ready` is set once the pending entry becomes a
 * real lease; `n` is null for a copy the pool could not number.
 * @typedef {object} Lease
 * @property {number | null} n
 * @property {string} actor_ip
 * @property {string} address
 * @property {string} devtools
 * @property {number} expires
 */

export class ChromeLeases {
  /** @type {{ restore: () => Promise<{ n: number, address: string, devtools: string, browser: string, pid: number }>, destroy: (n: number) => Promise<unknown> }} */
  pool
  /** @type {{ open: (actor_ip: string, copy_ip: string) => void, close: (actor_ip: string, copy_ip: string) => void }} */
  firewall
  /** @type {number} */
  minutes
  /** @type {() => number} */
  now
  /** @type {{ begin_work: (id: string, key: string) => void, end_work: (id: string, key: string) => void } | null} */
  work
  /**
   * A `{ ready: null }` placeholder while the pool restores, then the lease.
   * @type {Map<string, Lease | { ready: null }>}
   */
  leases = new Map()

  /**
   * pool: restore() and destroy(n). firewall: open/close(actor_ip, copy_ip).
   * work: holds the actor busy while it holds a copy.
   * @param {ChromeLeases['pool'] | import('./chrome-pool.js').ChromePool} pool
   * @param {{ firewall?: ChromeLeases['firewall'], minutes?: number, now?: () => number, work?: ChromeLeases['work'] }} [options]
   */
  constructor(
    pool,
    {
      firewall = iptables_firewall,
      minutes = LEASE_MINUTES,
      now = () => Date.now(),
      work = null
    } = {}
  ) {
    Object.assign(this, { pool, firewall, minutes, now, work })
    this.leases = new Map()
  }

  /** A fresh copy for this actor; an actor holds at most one, and leasing again replaces it. */
  async lease(actor_id, actor_ip) {
    if (this.leases.has(actor_id)) await this.give_back(actor_id)
    const pending = { ready: null }
    this.leases.set(actor_id, pending)
    let copy
    try {
      copy = await this.pool.restore()
    } catch (error) {
      this.leases.delete(actor_id)
      throw error
    }
    const lease = {
      n: copy.n,
      actor_ip,
      address: copy.address,
      devtools: copy.devtools,
      expires: this.now() + this.minutes * MS_PER_MINUTE
    }
    if (this.leases.get(actor_id) !== pending) {
      await this.pool.destroy(copy.n)
      throw new Error('lease was returned before it was ready')
    }
    this.firewall.open(actor_ip, copy.address)
    this.leases.set(actor_id, lease)
    this.work?.begin_work(actor_id, 'browser')
    LOG.info(
      `${actor_id} leased chrome copy ${copy.n} (${copy.address}) for ${this.minutes} min`
    )
    return {
      devtools: lease.devtools,
      expires: new Date(lease.expires).toISOString()
    }
  }

  async give_back(actor_id) {
    const lease = this.leases.get(actor_id)
    if (!lease) return false
    this.leases.delete(actor_id)
    this.work?.end_work(actor_id, 'browser')
    if (!('n' in lease)) return true
    if (lease.n === null || lease.n === undefined) return true
    this.firewall.close(lease.actor_ip, lease.address)
    await this.pool.destroy(lease.n)
    LOG.info(`${actor_id} returned chrome copy ${lease.n}`)
    return true
  }

  /** Destroy leases past their time or held by actors no longer live. Returns ids reaped. */
  async reap(live_ids) {
    const live = new Set(live_ids)
    const reaped = []
    for (const [id, lease] of this.leases) {
      if (!('n' in lease)) continue
      if (lease.n === null || lease.n === undefined) continue
      if (!live.has(id) || this.now() >= lease.expires) {
        reaped.push(id)
        await this.give_back(id)
      }
    }
    return reaped
  }
}
