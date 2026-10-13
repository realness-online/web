#!/usr/bin/env node

import { parseArgs as parse_args } from "node:util"
import { AppStore } from "../../src/host/apps.js"

const { positionals, values } = parse_args({
  allowPositionals: true,
  options: {
    volume: { type: "string", default: "/opt/fc/actors/mnt" },
    image: { type: "string", default: "/opt/fc/app.ext4" },
    kernel: { type: "string", default: "/opt/fc/vmlinux-6.1.155" },
    firecracker: { type: "string", default: "/opt/fc/firecracker" },
  },
})
const [command, arg] = positionals
if (!["start", "stop"].includes(command) || !arg) {
  console.error("usage: app.js start <files-dir> | stop <id>")
  process.exit(2)
}
const store = new AppStore(values)
if (command === "start") console.log(JSON.stringify(await store.start(arg)))
else await store.stop(arg)
process.exit(0)
