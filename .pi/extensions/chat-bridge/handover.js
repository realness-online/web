import { readFileSync as read_file_sync, realpathSync as realpath_sync } from 'node:fs'

/** Read the selected Durable conversation without converting it to a summary. */
export const read_handover = path => {
  const log = JSON.parse(read_file_sync(path, 'utf8'))
  if (log.version !== 1 || typeof log.handover_id !== 'string' || !Number.isSafeInteger(log.conversation_id))
    throw new Error('Invalid browser handover')
  const rows = log.stores?.entries
  if (!Array.isArray(rows)) throw new Error('Browser handover has no entries')
  const entries = rows
    .filter(row => row.value?.entry?.conversationId === log.conversation_id)
    .sort((left, right) => left.value.commitSeq - right.value.commitSeq || left.value.id - right.value.id)
    .map(row => row.value.entry)
  const messages = entries.flatMap(entry => entry.model ?? [])
  if (!messages.some(message => message.role === 'user')) throw new Error('Browser handover has no user conversation')
  return { id: log.handover_id, conversation_id: log.conversation_id, entries, messages, snapshot: realpath_sync(path) }
}

/** A receipt exists only after the imported transcript is part of the active Pi session. */
export const handover_receipt = (manager, id) =>
  manager
    .getBranch()
    .some(entry => entry.type === 'custom' && entry.customType === 'durable-handover' && entry.data?.id === id)
    ? { resumed: true, handover_id: id }
    : null

/** Keep the original Durable entry identities beside the imported terminal transcript. */
export const append_handover = async (manager, handover) => {
  for (const message of handover.messages) manager.appendMessage(message)
  manager.appendCustomEntry('durable-handover', {
    id: handover.id,
    conversation_id: handover.conversation_id,
    snapshot: handover.snapshot,
    entry_ids: handover.entries.map(entry => entry.id)
  })
}
