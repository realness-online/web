/**
 * Commands the chat input runs instead of sending to the model. The terminal's
 * Pi carries out all but copy; Pi setup commands stay in the terminal.
 * @type {Array<{ name: string, args?: string, description: string }>}
 */
export const chat_commands = [
  { name: 'stop', description: 'Stop Pi' },
  { name: 'new', description: 'Start a new session' },
  { name: 'compact', args: 'instructions', description: 'Compact the context' },
  { name: 'model', args: 'name', description: 'Show or switch the model' },
  {
    name: 'thinking',
    args: 'level',
    description: 'Show or set the thinking level'
  },
  { name: 'upstream', description: 'Read what another device wrote' },
  { name: 'copy', description: 'Copy the last reply' }
]

/** A command name is a word; a line like `/usr/bin is missing` stays a message. */
const COMMAND_LINE = /^\/([a-z][a-z-]*)(?:\s+([\s\S]*))?$/

/**
 * A command Pi lists goes to Pi as a message, as it would in the terminal.
 * @param {string} text
 * @param {Array<{ name: string }>} [from_pi]
 * @returns {{ name: string, args: string, unknown?: true } | null}
 */
export const parse_chat_command = (text, from_pi = []) => {
  const match = COMMAND_LINE.exec(text.trim())
  if (!match) return null
  const [, name, args = ''] = match
  if (chat_commands.some(command => command.name === name))
    return { name, args: args.trim() }
  if (from_pi.some(command => command.name === name)) return null
  return { name, args: args.trim(), unknown: true }
}

/** Commands whose names start with what is typed after the slash, until a space. */
export const matching_commands = (draft, from_pi = []) => {
  if (!draft.startsWith('/') || /\s/.test(draft)) return []
  const typed = draft.slice(1)
  return [...chat_commands, ...from_pi].filter(command =>
    command.name.startsWith(typed)
  )
}
