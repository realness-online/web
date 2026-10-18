/**
 * e11: a branch records its parent and anchor, so it can state the divergence
 * offline. `ConversationRecord.parent` already holds `{ conversationId, at }`;
 * nothing new is stored. This reads it back and says it in words.
 *
 * The record states where the branch left. It cannot state how far the parent
 * has gone since - that is e12's read.
 */

/**
 * @typedef {object} Divergence
 * @property {boolean} forked
 * @property {number | null} parent
 * @property {number | null} anchor
 */

/**
 * What a conversation's own record says about where it came from.
 * @param {{ parent?: { conversationId: number, at: number } } | undefined} record
 * @returns {Divergence}
 */
export const divergence_of = record => {
  const parent = record?.parent
  if (!parent) return { forked: false, parent: null, anchor: null }
  return { forked: true, parent: parent.conversationId, anchor: parent.at }
}

/**
 * One line a client can show with no network and no read of the parent.
 * @param {Divergence} divergence
 */
export const say_divergence = divergence =>
  divergence.forked
    ? `branched from ${divergence.parent} at ${divergence.anchor}`
    : 'the original line'

/**
 * Read one conversation record and describe it.
 * @param {{ conversation: (id: number, context: unknown) => Promise<unknown> }} storage
 * @param {number} conversation_id
 * @param {unknown} context
 */
export const read_divergence = async (storage, conversation_id, context) => {
  const record = await storage.conversation(conversation_id, context)
  return divergence_of(record)
}
