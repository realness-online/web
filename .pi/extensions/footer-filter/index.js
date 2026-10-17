/**
 * Footer filter: hides chosen extension status lines from pi's default footer.
 *
 * Keys come from `footer.hideStatuses` in the agent settings.json. Pi keeps
 * every status in one shared footer data provider, so the filter wraps that
 * provider's setter and drops hidden keys. The built-in footer stays in place,
 * so nothing of its layout is copied here.
 */
import { readFileSync as read_file_sync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/** Status keys hidden when settings name none. */
export const DEFAULT_HIDDEN = ["claude-oauth-ready"]

/** Hidden status keys from settings, or the default list. */
export const hidden_keys = (
  settings_path = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent"), "settings.json"),
) => {
  try {
    const keys = JSON.parse(read_file_sync(settings_path, "utf8")).footer?.hideStatuses
    return new Set(Array.isArray(keys) ? keys : DEFAULT_HIDDEN)
  } catch {
    return new Set(DEFAULT_HIDDEN)
  }
}

/** Makes a footer data provider drop hidden keys, now and on every later set. */
export const filter_provider = (provider, hidden) => {
  if (provider.footer_filter_applied) return
  const set = provider.setExtensionStatus.bind(provider)
  provider.setExtensionStatus = (key, text) => set(key, hidden.has(key) ? undefined : text)
  for (const key of hidden) set(key, undefined)
  provider.footer_filter_applied = true
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function (pi) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return
    const hidden = hidden_keys()
    if (hidden.size === 0) return
    ctx.ui.setFooter((_tui, _theme, provider) => {
      filter_provider(provider, hidden)
      return { render: () => [], invalidate() {} }
    })
    ctx.ui.setFooter(undefined)
  })
}
