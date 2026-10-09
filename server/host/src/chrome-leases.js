// Chrome leases (c2): an actor asks the door for a Chrome, gets a fresh copy
// from the pool, and gives it back; a returned or expired copy is destroyed,
// never reused. The firewall opens exactly one actor to its one copy:
// the actor reaches DevTools, and the copy reaches the actor (its dev server).
//
//   {"op": "chrome-lease"}   -> {"ok": true, "devtools": "http://172.19.<n>.2:9222", "expires": "..."}
//   {"op": "chrome-return"}  -> {"ok": true, "returned": true}

import { run } from "./host.js"
import { DEVTOOLS_PORT } from "./chrome-pool.js"
import { logger } from "./log.js"

const LOG = logger("chrome-leases")
export const LEASE_MINUTES = 30
const CHAIN = "BRAYNESS-LEASE"

/** The iptables rule bodies for one lease, actor and copy as addresses. Pure. */
export const lease_rules = (actor, copy) => [
  ["-s", actor, "-d", copy, "-p", "tcp", "--dport", String(DEVTOOLS_PORT), "-m", "conntrack", "--ctstate", "NEW,ESTABLISHED", "-j", "ACCEPT"],
  ["-s", copy, "-d", actor, "-p", "tcp", "-m", "conntrack", "--ctstate", "NEW,ESTABLISHED", "-j", "ACCEPT"],
  ["-s", copy, "-d", actor, "-p", "tcp", "--sport", String(DEVTOOLS_PORT), "-m", "conntrack", "--ctstate", "ESTABLISHED", "-j", "ACCEPT"],
  ["-s", actor, "-d", copy, "-p", "tcp", "-m", "conntrack", "--ctstate", "ESTABLISHED", "-j", "ACCEPT"]
]

export const iptables_firewall = {
  open: (actor, copy) => {
    for (const rule of lease_rules(actor, copy)) run(["iptables", "-A", CHAIN, ...rule])
  },
  close: (actor, copy) => {
    for (const rule of lease_rules(actor, copy)) while (run(["iptables", "-D", CHAIN, ...rule], { check: false }).code === 0);
  }
}

export class ChromeLeases {
  /** pool: restore() and destroy(n). firewall: open/close(actor_ip, copy_ip). */
  constructor(pool, { firewall = iptables_firewall, minutes = LEASE_MINUTES, now = () => Date.now() } = {}) {
    Object.assign(this, { pool, firewall, minutes, now })
    this.leases = new Map() // actor id -> { n, actor_ip, address, devtools, expires, ready }
  }

  /** A fresh copy for this actor; an actor holds at most one, and leasing again replaces it. */
  async lease(actor_id, actor_ip) {
    if (this.leases.has(actor_id)) await this.give_back(actor_id)
    // Held during the restore so a second request waits on the first's give_back, not a race.
    const pending = { ready: null }
    this.leases.set(actor_id, pending)
    let copy
    try {
      copy = await this.pool.restore()
    } catch (error) {
      this.leases.delete(actor_id)
      throw error
    }
    const lease = { n: copy.n, actor_ip, address: copy.address, devtools: copy.devtools, expires: this.now() + this.minutes * 60_000 }
    if (this.leases.get(actor_id) !== pending) {
      // Returned or reaped while restoring: the copy is not wanted.
      await this.pool.destroy(copy.n)
      throw new Error("lease was returned before it was ready")
    }
    this.firewall.open(actor_ip, copy.address)
    this.leases.set(actor_id, lease)
    LOG.info(`${actor_id} leased chrome copy ${copy.n} (${copy.address}) for ${this.minutes} min`)
    return { devtools: lease.devtools, expires: new Date(lease.expires).toISOString() }
  }

  async give_back(actor_id) {
    const lease = this.leases.get(actor_id)
    if (!lease) return false
    this.leases.delete(actor_id)
    if (lease.n == null) return true // still restoring; lease() destroys it on arrival
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
      if (lease.n == null) continue
      if (!live.has(id) || this.now() >= lease.expires) {
        reaped.push(id)
        await this.give_back(id)
      }
    }
    return reaped
  }
}
