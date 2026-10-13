/**
 * Copy every reported `copy` row through the mirror's own reconciliation:
 * the same durable journal, revision guards and conflict rules as live events.
 * Conflicts and unverified rows are never written; they stay for review.
 * One row failing does not stop the rest. Rerunning is safe: settled pairs
 * are no-ops, and anything changed since the report is re-inspected live.
 * @param {object} options
 * @param {Array<{source: string, status: string}>} options.rows
 * @param {(name: string) => Promise<{action: string, reason?: string}>} options.reconcile
 * @param {number} [options.concurrency]
 * @returns {Promise<{counts: Record<string, number>, failures: Array<object>}>}
 */
export const migration_apply = async ({ rows, reconcile, concurrency = 8 }) => {
  const pending = rows.filter(row => row.status === 'copy').map(row => row.source)
  const counts = {}
  const failures = []
  const tally = key => { counts[key] = (counts[key] || 0) + 1 }
  const worker = async () => {
    while (pending.length) {
      const name = pending.shift()
      try {
        // eslint-disable-next-line no-await-in-loop -- bounded pool of workers
        const result = await reconcile(name)
        tally(result.reason ? `${result.action}:${result.reason}` : result.action)
        if (result.action === 'conflict') failures.push({ name, reason: result.reason })
      } catch (error) {
        tally('error')
        failures.push({ name, error: error.message, code: error.code })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))
  return { counts, failures }
}
