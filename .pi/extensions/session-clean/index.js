/**
 * Session clean: a session is cleaned where pi writes it, so one copy exists
 * and a secret never leaves the Mac. After a turn that grew the session file,
 * known secrets and key shapes become `[secret]`. Outside contacts stay until
 * a session is shared, which `clean_text` handles.
 *
 * Public extension API only; no change to Pi itself.
 */
import { statSync as stat } from 'node:fs'
import { clean_file, known_secrets } from '../../bin/sessions/share-clean.js'
import { harness_root } from '../../bin/lib/harness-settings.js'

const size_of = path => stat(path, { throwIfNoEntry: false })?.size ?? -1

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
const session_clean = (pi, { root = harness_root() ?? process.cwd() } = {}) => {
  const state = { secrets: [], file: null, size: -1 }

  const clean = ctx => {
    const file = ctx.sessionManager.getSessionFile?.()
    if (!file?.endsWith('.gz')) return
    if (file !== state.file) {
      state.file = file
      state.size = -1
    }
    const before = size_of(file)
    if (before === state.size) return
    clean_file(file, { secrets: state.secrets })
    state.size = size_of(file)
  }

  pi.on('session_start', () => {
    state.secrets = known_secrets(root)
    state.file = null
    state.size = -1
  })

  pi.on('turn_end', (_event, ctx) => clean(ctx))

  pi.on('session_shutdown', (_event, ctx) => clean(ctx))
}

export default session_clean
