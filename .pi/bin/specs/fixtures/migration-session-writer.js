import { SessionManager } from '../../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js'

process.env.PI_SESSION_FORMAT = 'html.gz'
const [action, path, parent] = process.argv.slice(2)
const manager =
  action === 'append' ? SessionManager.open(path) : SessionManager.create(path, path, { parentSession: parent })
manager.appendMessage({ role: 'user', content: 'recorded after the format switch', timestamp: Date.now() })
process.stdout.write(manager.getSessionFile())
