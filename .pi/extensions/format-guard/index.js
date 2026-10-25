/**
 * Format guard: code is formatted by its project's own tool, never prettier.
 *
 * A Vite Plus project formats with `vp fmt` (its `fmt` block in
 * `vite.config.js`). Harness code under `.pi/` formats with prettier and
 * `.pi/.prettierrc.json`. A `bash` call that runs prettier to rewrite
 * anything else but markdown is blocked with the command to use instead.
 * Checking (`--check`, `--list-different`) and markdown stay allowed, so
 * the readable skill's `wrap.sh` still works.
 *
 * Public extension API only (`tool_call` blocks); no change to Pi itself.
 */

const PRETTIER = /(^|[\s;&|(`/])prettier(\s[^;&|\n]*)?/g
const WRITES = /(^|\s)(--write|-w)(\s|$)/
const PROSE = /\.(md|mdx|markdown)$/i
const HARNESS = /^(\.\/)?\.pi\/(?!node_modules\/|runtime\/)/

/** Why a command may not run, or null when it may. */
export const prettier_rewrites_code = command => {
  if (typeof command !== 'string') return null
  for (const [, , args = ''] of command.matchAll(PRETTIER)) {
    if (!WRITES.test(args)) continue
    const targets = [...args.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)]
      .map(([, double, single, bare]) => double ?? single ?? bare)
      .filter(word => !word.startsWith('-') && !/^[<>]|^\d?>/.test(word))
    if (!targets.length || targets.some(target => !PROSE.test(target) && !HARNESS.test(target)))
      return 'prettier rewriting code'
  }
  return null
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
const format_guard = pi => {
  pi.on('tool_call', event => {
    if (event.toolName !== 'bash') return
    const input = /** @type {Record<string, unknown>} */ (event.input ?? {})
    if (!prettier_rewrites_code(input.command)) return
    return {
      block: true,
      reason:
        'Code is formatted by its project, never prettier (AGENTS.md). In a project with vite.config.js run `npx vp fmt <files>` from that project; prettier is for markdown (.pi/skills/readable/scripts/wrap.sh) and harness code under .pi/ (.pi/.prettierrc.json).'
    }
  })
}

export default format_guard
