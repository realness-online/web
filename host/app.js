#!/usr/bin/env node
// One app VM by hand, from a host folder. The API (/v1/apps) starts apps from
// an actor's work folder. The record is the last line of stdout; log lines come before it.
//
//   sudo node host/app.js start <files-dir>   prints the record as JSON
//   sudo node host/app.js stop <id>

import { parseArgs } from "node:util"
import { AppStore } from "./src/apps.js"

const { positionals, values } = parseArgs({
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
