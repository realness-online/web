import { spawn } from 'node:child_process'
import { defineConfig as define_config } from 'vite'

const DEFAULT_BRIDGE_PORT = 8779
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || DEFAULT_BRIDGE_PORT)

// In dev, a local pty bridge stands in for a hosted session's /pty.
const pty_bridge = () => ({
  name: 'pty-bridge',
  apply: 'serve',
  configureServer(server) {
    const bridge = spawn('python3', ['bridge.py', String(BRIDGE_PORT)], {
      stdio: 'inherit'
    })
    server.httpServer?.on('close', () => bridge.kill())
  }
})

export default define_config({
  // Relative asset URLs, so the build works under any mount such as /s/<id>/.
  base: './',
  plugins: [pty_bridge()],
  server: {
    proxy: { '/pty': { target: `ws://127.0.0.1:${BRIDGE_PORT}`, ws: true } }
  }
})
