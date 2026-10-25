/**
 * Scratch guard: scratch goes to `artifacts/`, never the system temp folder.
 *
 * A `bash`, `write`, or `edit` call that names `/tmp`, `/private/tmp`, or
 * `/var/folders` is blocked, with the folder to use instead. Every bash
 * command runs with `TMPDIR` set to `artifacts/tmp/`, so programs that make
 * their own temp files (`os.tmpdir()`, Python's `tempfile`) land there too,
 * and `$TMPDIR` stays allowed. macOS `mktemp` ignores `TMPDIR`, so a
 * `mktemp` that names no location is blocked as well. Calls a tool makes, such as codemode's, pass
 * through here as well.
 *
 * Public extension API only (`tool_call` blocks or mutates input); no change
 * to Pi itself, so upstream updates stay clean.
 */
import { join } from 'node:path'
import { harness_root } from '../../bin/lib/harness-settings.js'

const SYSTEM_TEMP = /(^|[\s"'`=:(<>|;&])(\/private)?\/(tmp|var\/folders)(\/|(?=[\s"'`;|&)]|$))/

const MKTEMP = /(^|[\s;&|(`$])mktemp\b([^;&|\n]*)/g

/** The system temp folder a command or path names, or null. */
export const names_system_temp = text => {
  if (typeof text !== 'string') return null
  const match = text.match(SYSTEM_TEMP)
  if (match) return `/${match[2] ? 'private/' : ''}${match[3]}`
  for (const [, , args] of text.matchAll(MKTEMP))
    if (!/\$\{?TMPDIR|artifacts\//.test(args)) return "mktemp's default folder (macOS ignores TMPDIR)"
  return null
}

/** The command with TMPDIR pointed at the harness scratch folder. */
export const with_scratch_tmpdir = (command, tmp) =>
  `export TMPDIR=${JSON.stringify(tmp)}; mkdir -p "$TMPDIR"\n${command}`

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
const scratch_guard = (pi, { root = harness_root() ?? process.cwd() } = {}) => {
  const tmp = join(root, 'artifacts', 'tmp')
  const reason = path =>
    `Scratch goes to artifacts/<project>/ (AGENTS.md), not ${path}. ` +
    `Use ${join(root, 'artifacts')}/<project>/ for files you keep, or $TMPDIR (${tmp}/) for throwaways: mktemp "$TMPDIR/name.XXXXXX".`

  pi.on('tool_call', event => {
    const input = /** @type {Record<string, unknown>} */ (event.input ?? {})
    if (event.toolName === 'bash') {
      const named = names_system_temp(input.command)
      if (named) return { block: true, reason: reason(named) }
      input.command = with_scratch_tmpdir(String(input.command ?? ''), tmp)
      return
    }
    if (event.toolName === 'write' || event.toolName === 'edit') {
      const named = names_system_temp(input.path)
      if (named) return { block: true, reason: reason(named) }
    }
  })
}

export default scratch_guard
