import { read_page } from '#root/src/files/item-log.js'

/** A read tool reads a page; a lease tool takes Chrome for a login source. */
const READ_TOOLS = /realness-read|site-read/
const LEASE_TOOLS = /realness-chrome|agent-browser/

/**
 * The stage a record belongs to: the read of a page, the lease of Chrome, or
 * the work that scores what was read. Everything that is neither a read nor a
 * lease is scoring, tool study included.
 * @param {{ tool?: string }} record
 * @returns {'read' | 'lease' | 'score'}
 */
export const kind_of = record => {
  const tool = record.tool ?? ''
  if (READ_TOOLS.test(tool)) return 'read'
  if (LEASE_TOOLS.test(tool)) return 'lease'
  return 'score'
}

/**
 * What pi was doing, as stages, from the records a run keeps: each record
 * opens a stage of its kind, and neighbouring records of one kind are one
 * stage. A stage runs until the next record, so a run's stages cover it whole.
 * @param {{ at: number, tool?: string }[]} records in the order pi made them
 * @param {number} [ended] when pi stopped, for the last stage
 * @returns {{ name: string, kind: string, started: string, ended: string }[]}
 */
export const pi_stages = (records, ended = 0) => {
  const stages = []
  for (const record of records) {
    const name = kind_of(record)
    const started = new Date(record.at).toISOString()
    const last = stages.at(-1)
    if (last && last.name === name) continue
    if (last) last.ended = started
    stages.push({ name, kind: 'work', started, ended: '' })
  }
  const last = stages.at(-1)
  if (last)
    last.ended = new Date(ended || (records.at(-1)?.at ?? 0)).toISOString()
  return stages.filter(one => one.ended !== one.started)
}
/** Where a run keeps what pi was doing: a page of records, one per append. */
export const STAGES_PAGE = 'stages.html.gz'

/**
 * The records a run left beside its log, oldest first. A run that wrote none
 * has no record of what pi did.
 * @param {string} path the run's stage page
 * @returns {Promise<{ at: number, tool?: string }[]>}
 */
export const read_stages = async path =>
  (await read_page(path, 'stage')).map(record => ({
    at: Number(record.at),
    tool: record.tool ?? ''
  }))
