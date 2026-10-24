#!/usr/bin/env node
/**
 * Relay one TCP port to another address, so local actors reach the Mac's
 * proxy through a halo port their network allows.
 *
 *   node port-forward.js <listen-port> <target-host> <target-port>
 */
import { createServer as create_server, connect } from 'node:net'

const [listen_port, target_host, target_port] = process.argv.slice(2)
if (!listen_port || !target_host || !target_port) {
  process.stderr.write(
    'usage: port-forward.js <listen-port> <target-host> <target-port>\n'
  )
  process.exit(1)
}

const server = create_server(socket => {
  const upstream = connect(Number(target_port), target_host)
  socket.pipe(upstream).pipe(socket)
  const close = () => {
    socket.destroy()
    upstream.destroy()
  }
  socket.on('error', close)
  upstream.on('error', close)
})
server.listen(Number(listen_port), '0.0.0.0', () =>
  process.stdout.write(
    `forwarding :${listen_port} -> ${target_host}:${target_port}\n`
  )
)
