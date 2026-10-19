/** Pixels from the bottom that still count as reading the newest message. */
export const AT_END_SLACK = 8

/**
 * Whether a scroll container shows its end, within a small slack.
 * @param {{ scrollHeight: number, scrollTop: number, clientHeight: number }} element
 * @param {number} [slack]
 */
export const is_at_end = (element, slack = AT_END_SLACK) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= slack
