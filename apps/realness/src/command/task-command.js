import { find_root } from '#root/src/harness/harness.js'
import { task_paths } from '#root/src/harness/task.js'
import { token_source } from '#root/src/sign-on/node/login.js'
import { development_settings } from '#root/src/settings/environments.js'
import { HTTP } from '#root/lib/http.js'

/** The development gate, unless GATE_URL says otherwise. */
export const GATE_URL =
  process.env.GATE_URL ?? development_settings.services.gate_url

/**
 * `realness task <plan>` names what a task on that plan may touch;
 * `--start` asks the gate for a VM limited to exactly that.
 */
export const run_task = async (
  args,
  {
    root = find_root(),
    get_token = token_source(),
    gate_url = GATE_URL,
    fetcher = fetch,
    stdout = process.stdout,
    stderr = process.stderr
  } = {}
) => {
  const json = args.includes('--json')
  const start = args.includes('--start')
  const [plan] = args.filter(arg => !arg.startsWith('--'))
  if (!plan) {
    stderr.write('usage: realness task <plan> [--start] [--json]\n')
    return 2
  }
  const paths = await task_paths(root, plan)
  let actor = null
  if (start) {
    const token = await get_token()
    if (!token) throw new Error('not signed in; run realness login')
    const response = await fetcher(`${gate_url}/v1/actors`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ paths })
    })
    if (response.status !== HTTP.CREATED)
      throw new Error(
        `the gate refused the task: ${response.status} ${(await response.text()).trim()}`
      )
    actor = await response.json()
  }
  if (json)
    stdout.write(
      `${JSON.stringify({
        ok: true,
        command: 'task',
        result: { plan, paths, actor }
      })}\n`
    )
  else {
    stdout.write(
      `${plan}: ${paths.length} paths\n${paths.map(path => `  ${path}\n`).join('')}`
    )
    if (actor) stdout.write(`started ${actor.id}\n`)
  }
  return 0
}
