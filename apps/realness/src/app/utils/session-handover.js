/** Only a missing execution environment in this turn requests VM ownership. */
export const needs_actor = ({ entries = [] }) => {
  const start = entries.findLastIndex(entry => entry.kind === 'pi.user')
  return entries
    .slice(start + 1)
    .some(entry =>
      (entry.model ?? []).some(
        message =>
          message.role === 'toolResult' &&
          message.toolName === 'bash' &&
          message.isError === true &&
          (message.content ?? []).some(
            part =>
              part.type === 'text' &&
              part.text.includes('No execution environment is configured')
          )
      )
    )
}

/** Keep the browser log until the VM confirms that it resumed the session. */
export const create_handover = deliver => {
  let pending = null
  let resumed = false
  return {
    get pending() {
      return pending !== null
    },
    get resumed() {
      return resumed
    },
    hold(log) {
      if (pending) throw new Error('A session is already waiting for handover')
      pending = log
    },
    async transfer(user, actor) {
      if (!pending) return
      const log = pending
      const receipt = await deliver(user, actor, log)
      if (receipt?.resumed !== true || receipt.handover_id !== log.handover_id)
        throw new Error('The machine has not resumed this session')
      if (pending === log) {
        pending = null
        resumed = true
      }
      return receipt
    }
  }
}
