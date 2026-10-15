export const check_capacity_result = (workload, result) => {
  if (result.exit_code !== 0)
    throw new Error(`${workload.name}: guest exit ${result.exit_code}`)
  if (workload.pi_reply === undefined) return
  const output = Buffer.from(result.stdout_b64 ?? '', 'base64').toString()
  const events = output
    .trim()
    .split('\n')
    .map(line => JSON.parse(line))
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
}
