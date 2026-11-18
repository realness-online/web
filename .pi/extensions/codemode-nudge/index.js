/**
 * Codemode nudge: when one reply makes three or more direct tool calls, the
 * third result carries a line asking the model to batch them in codemode.
 * Calls made from inside codemode carry a parent id and do not count.
 */

/** Direct calls in one reply that trigger the nudge. */
export const LIMIT = 3

/** The line added to the tool result; usage.js finds nudges by this text. */
export const NUDGE =
  '[codemode-nudge] Three or more tool calls in one reply: batch them in one codemode script next time.'

/**
 * Whether this result is the one that gets the nudge.
 * @param {number} count direct calls seen this turn, this one included
 */
export const should_nudge = count => count === LIMIT

/** @param {any} pi */
export default function (pi) {
  let count = 0

  pi.on('turn_start', async () => {
    count = 0
  })

  pi.on('tool_result', async event => {
    if (event.parentToolCallId || event.toolName === 'codemode') return
    count++
    if (!should_nudge(count)) return
    return { content: [...(event.content ?? []), { type: 'text', text: NUDGE }] }
  })
}
