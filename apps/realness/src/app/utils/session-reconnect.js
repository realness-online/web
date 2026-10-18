/**
 * e10: reconnect compares one number. A client offline from a session keeps
 * committing to its own log. On reconnect it reads the shared tail:
 *
 *   our tail equals theirs   -> we never diverged; continue at tail + 1
 *   our tail below theirs    -> they wrote; our log continues theirs
 *   our tail above theirs    -> we wrote while away; our log is a branch
 *
 * Only the tail travels. `decide` is the whole rule, and it takes nothing but
 * two numbers.
 */

/** @typedef {'continue' | 'follow' | 'branch'} Verdict */

/**
 * @param {number} ours the local log's highest commit sequence
 * @param {number} theirs the shared log's highest commit sequence
 * @returns {{ verdict: Verdict, next: number }}
 */
export const decide = (ours, theirs) => {
  if (ours === theirs) return { verdict: 'continue', next: ours + 1 }
  if (ours < theirs) return { verdict: 'follow', next: theirs + 1 }
  return { verdict: 'branch', next: ours + 1 }
}

/**
 * Which entries the local log holds that the shared log does not, by sequence.
 * Every one of them belongs to the branch.
 * @param {number[]} ours
 * @param {number[]} theirs
 */
export const mine_only = (ours, theirs) => {
  const known = new Set(theirs)
  return ours.filter(seq => !known.has(seq))
}

/**
 * The comparison a reconnecting client makes, from two exported logs.
 * @param {{ tail: number, stores: { entries: { value: { commitSeq: number } }[] } }} ours
 * @param {{ tail: number, stores: { entries: { value: { commitSeq: number } }[] } }} theirs
 */
export const reconnect = (ours, theirs) => {
  const decision = decide(ours.tail, theirs.tail)
  return {
    ...decision,
    our_tail: ours.tail,
    their_tail: theirs.tail,
    branch_entries:
      decision.verdict === 'branch' ? mine_only(ours.seqs, theirs.seqs) : []
  }
}

/** The commit sequences in an exported log, ascending. */
export const seqs_of = log =>
  log.stores.entries.map(({ value }) => value.commitSeq).sort((a, b) => a - b)
