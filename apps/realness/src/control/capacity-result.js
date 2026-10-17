export const check_capacity_result = (workload, result) => {
  if (result.exit_code !== 0)
    throw new Error(`${workload.name}: guest exit ${result.exit_code}`)
  if (workload.pi_reply === undefined && !workload.guest_evidence) return null
  const output = Buffer.from(result.stdout_b64 ?? '', 'base64').toString()
  const events = output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
  const evidence = events.findLast(event => event.type === 'capacity_workload')
  if (workload.guest_evidence) {
    if (
      evidence?.kind !== workload.name ||
      !Number.isFinite(evidence.elapsed_ms) ||
      evidence.elapsed_ms <= 0
    )
      throw new Error(`${workload.name}: missing guest execution evidence`)
    if (
      evidence.memory_source !== 'proc-meminfo' ||
      !Number.isFinite(evidence.guest_peak_mib) ||
      evidence.guest_peak_mib <= 0
    )
      throw new Error(`${workload.name}: missing guest memory evidence`)
    if (
      evidence.kind === 'browser' &&
      (!evidence.browser_verified || !evidence.browser_released)
    )
      throw new Error('browser: page verification and lease release required')
  }
  if (workload.pi_reply === undefined) return evidence ?? null
  const reply = events.findLast(
    event => event.type === 'message_end' && event.message?.role === 'assistant'
  )
  if (
    reply?.message?.stopReason !== 'stop' ||
    !reply.message.content?.some(
      block => block.type === 'text' && block.text.trim() === workload.pi_reply
    )
  )
    throw new Error(`${workload.name}: no completed expected Pi reply`)
  if (!events.some(event => event.type === 'agent_settled'))
    throw new Error(`${workload.name}: Pi did not settle`)
  return evidence ?? null
}
