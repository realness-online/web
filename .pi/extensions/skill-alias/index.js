/**
 * Skill alias: `/planning` runs the planning skill, as `/skill:planning` does.
 *
 * Pi names skill commands `skill:<name>`. People type the short name, in the
 * terminal and in the page's chat box alike. Each skill without a command of
 * its own name gets a short command that sends the full skill command.
 */

/** The skill names among Pi's commands, minus any a real command already holds. */
export const skill_names = commands => {
  const taken = new Set(commands.filter(command => command.source !== 'skill').map(command => command.name))
  return commands
    .filter(command => command.source === 'skill' && command.name.startsWith('skill:'))
    .map(command => command.name.slice('skill:'.length))
    .filter(name => !taken.has(name))
}

/**
 * `/name rest` as `/skill:name rest` when `name` is a skill; otherwise null.
 * @param {string} text
 * @param {string[]} names
 */
export const as_skill_command = (text, names) => {
  const match = /^\/([a-z0-9][a-z0-9-]*)(\s[\s\S]*)?$/.exec(text.trim())
  if (!match) return text.trim().startsWith('/skill:') ? text.trim() : null
  return names.includes(match[1]) ? `/skill:${match[1]}${match[2] ?? ''}` : null
}

export default pi => {
  pi.on('session_start', () => {
    for (const name of skill_names(pi.getCommands()))
      pi.registerCommand(name, {
        description: `Run the ${name} skill`,
        handler: async args => {
          pi.sendUserMessage(`/skill:${name}${args ? ` ${args}` : ''}`, { expandPromptTemplates: true })
        }
      })
  })
}
