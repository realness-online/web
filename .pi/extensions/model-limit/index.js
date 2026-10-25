import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const GUEST = '/etc/realness'

export const proxy_origin = (models_path = join(homedir(), '.pi/agent/models.json')) => {
  try {
    return new URL(JSON.parse(read_file_sync(models_path, 'utf8')).providers.realness.baseUrl).origin
  } catch {
    return null
  }
}

const model_pass = () =>
  new Promise((resolve, reject) =>
    exec_file('realness-model-pass', { timeout: 10_000 }, (error, stdout) =>
      error ? reject(error) : resolve(stdout.trim())
    )
  )

export const next_warning = (status, shown, today = new Date().toISOString().slice(0, 10)) => {
  const warn = status?.warn
  if (!warn?.message) return null
  const key = `${today} ${warn.limit} ${warn.at ?? ''}`
  if (shown.has(key)) return null
  shown.add(key)
  return warn.message
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
const model_limit = pi => {
  if (!exists_sync(GUEST)) return
  const origin = proxy_origin()
  if (!origin) return
  const shown = new Set()
  pi.on('agent_end', async (_event, ctx) => {
    try {
      const reply = await fetch(`${origin}/limit`, {
        headers: { authorization: `Bearer ${await model_pass()}` },
        signal: AbortSignal.timeout(5000)
      })
      if (!reply.ok) return
      const message = next_warning(await reply.json(), shown)
      if (message) ctx.ui.notify(message, 'warning')
    } catch {}
  })
}

export default model_limit
