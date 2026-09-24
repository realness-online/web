// brayness - boots pi with the embedded harness beside the binary
import { dirname, join } from "node:path"
import { existsSync, mkdirSync, cpSync, chmodSync, statSync, readdirSync } from "node:fs"

const here = dirname(Deno.execPath())
const workspace = join(here, "brayness-workspace")
const agent_dir = join(workspace, ".pi", "agent")

// embedded harness, extracted once - never overwrites what she has edited
const embedded = import.meta.dirname ?? here
const extracted: string[] = []
for (const part of ["skills", "extensions", "prompts", "themes", "AGENTS.md", "work"]) {
  const dest = join(workspace, part)
  const src = join(embedded, part)
  if (existsSync(dest) || !existsSync(src)) continue
  cpSync(src, dest, { recursive: true })
  extracted.push(dest)
}
// embedded files arrive read-only - make the extracted copy editable
function make_writable(path: string) {
  const info = statSync(path)
  chmodSync(path, info.isDirectory() ? 0o755 : 0o644)
  if (info.isDirectory()) {
    for (const child of readdirSync(path)) make_writable(join(path, child))
  }
}
for (const path of extracted) make_writable(path)

mkdirSync(agent_dir, { recursive: true })

Deno.env.set("PI_CODING_AGENT_DIR", agent_dir)
Deno.chdir(workspace)

// build.sh replaces the version token before Deno compiles this entry.
const { main } = await import("npm:@earendil-works/pi-coding-agent@__PI_VERSION__")
// skills stay visible at the workspace root, so load them explicitly
const manage = ["install", "remove", "uninstall", "update", "list", "config", "auth",
  "--help", "-h", "--version", "-v", "--list-models"]
const args = [...Deno.args]
if (!args.some((a) => manage.includes(a)) && !args.includes("--no-skills") && !args.includes("--skill")) {
  args.push("--skill", join(workspace, "skills"))
}
await main(args)
