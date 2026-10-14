import { spawn } from 'node:child_process'
import { writeFileSync as write_file_sync } from 'node:fs'

const child = spawn(
  process.execPath,
  [
    '-e',
    `
  process.on('SIGTERM', () => {})
  setInterval(() => {}, 1000)
  process.send('ready')
`
  ],
  { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }
)
child.on('message', () => {
  write_file_sync(
    process.argv[2],
    JSON.stringify({ parent: process.pid, child: child.pid })
  )
})
setInterval(() => {}, 1000)
