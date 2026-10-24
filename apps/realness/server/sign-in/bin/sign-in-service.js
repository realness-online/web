#!/usr/bin/env node
import { execFile as exec_file } from 'node:child_process'
import { createServer as create_server } from 'node:http'
import { disk } from '#root/src/can/disk.js'
import { out_path } from '#root/lib/output.js'
import { sign_in_issuer } from '#root/src/sign-in/issuer.js'
import { sign_in_handler } from '#root/src/sign-in/server.js'

const { env } = process
const project = env.IDENTITY_PROJECT
if (!project) throw new Error('sign-in needs IDENTITY_PROJECT')
const storage = disk(env.SIGN_IN_DIR ?? out_path('sign-in'))
const issuer = await sign_in_issuer(storage, { project })
const handler = sign_in_handler({
  issuer,
  storage,
  deliver: (phone, code) => {
    console.log(`sign-in code for ${phone}: ${code}`)
    if (process.platform === 'darwin')
      exec_file(
        'osascript',
        [
          '-e',
          `display notification "${code}" with title "Realness sign-in" subtitle "${phone}"`
        ],
        () => {}
      )
  }
})

const port = Number(env.PORT ?? 8793)
const listen = env.LISTEN ?? '127.0.0.1'
create_server(handler).listen(port, listen, () =>
  console.log(`sign-in on ${listen}:${port} for ${project}`)
)
