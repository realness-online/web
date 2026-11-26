/**
 * p1: app chat starts with the harness's rules and the skills that shape
 * plans. They are the harness's own files, built into the app
 * (scripts/lib/explorer-brief.js), so chat opens without waking the VM.
 */
import brief from 'virtual:explorer-brief'

export const EXPLORER_ROLE =
  "You are Explorer. Use bash for shell requests and read, write, and edit for files. Commands and files are on the person's VM; this browser keeps the conversation."

/** The instructions chat starts with: its role, then each harness file. */
export const explorer_instructions = () =>
  [
    EXPLORER_ROLE,
    ...brief.map(
      ([heading, path, text]) =>
        `# ${heading} (/realness/${path})\n\n${text.trim()}`
    )
  ].join('\n\n')
