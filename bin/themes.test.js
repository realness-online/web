import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync as read_file_sync, writeFileSync as write_file_sync, mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, cpSync as cp_sync, rmSync as rm_sync, existsSync as exists_sync, readlinkSync as readlink_sync, symlinkSync as symlink_sync } from "node:fs"
import { spawnSync as spawn_sync } from "node:child_process"
import { join, relative, resolve } from "node:path"
import { load_theme } from "../apps/realness/themes/load.js"
import { link_ghostty, render_theme } from "./themes.js"

const root = resolve(import.meta.dirname, "..")
const baseline = name => read_file_sync(join(import.meta.dirname, "fixtures/theme-baseline", name), "utf8")
const resolved_colors = theme => Object.fromEntries(Object.entries(theme.colors).map(([key, value]) => [key, theme.vars[value] ?? value]))
const without_comments = text => text.split("\n").filter(line => !/^\s*(#|--)/.test(line)).join("\n")
const base16_values = text => [...text.matchAll(/base[\dA-F]{2} = "(#[\da-f]{6})"/g)].map(match => match[1])

const scratch = t => {
  mkdir_sync(join(root, "artifacts/themes"), { recursive: true })
  const path = mkdtemp_sync(join(root, "artifacts/themes/test-"))
  t.after(() => rm_sync(path, { recursive: true, force: true }))
  return path
}
const cli = (...args) => spawn_sync(process.execPath, [join(root, "bin/themes.js"), ...args], { cwd: root, encoding: "utf8" })

/** Effective role values include inherited light declarations in dark mode. */
const css_values = css => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const blocks = [...clean.matchAll(/:root\s*\{([^}]+)\}/g)].map(match => Object.fromEntries([...match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value])))
  return [blocks[0], { ...blocks[0], ...blocks[1] }]
}

test("Realness preserves every Ghostty, pi, nvim and web color", () => {
  const files = render_theme(load_theme(join(root, "apps/realness/themes/realness"), "realness"))
  for (const scheme of ["light", "dark"]) {
    assert.equal(without_comments(files.get(`ghostty/realness-${scheme}`)), without_comments(baseline(`realness-${scheme}`)))
    const previous = JSON.parse(baseline(`realness-${scheme}.json`))
    const current = JSON.parse(files.get(`pi/realness-${scheme}.json`))
    assert.deepEqual(resolved_colors(current), resolved_colors(previous))
    assert.deepEqual(current.export, previous.export)
  }
  assert.deepEqual(base16_values(files.get("nvim/realness.lua")), base16_values(baseline("realness.lua")))
  assert.deepEqual(css_values(files.get("web/color.css")), css_values(baseline("color.css")))
})

test("Pi uses the brand accent for user messages in both appearances", () => {
  const files = render_theme(load_theme(join(root, "apps/realness/themes/realness"), "realness"))
  for (const scheme of ["light", "dark"]) {
    const theme = JSON.parse(files.get(`pi/realness-${scheme}.json`))
    assert.equal(theme.colors.userMessageText, "accent")
    assert.equal(resolved_colors(theme).userMessageText, theme.vars.accent)
  }
})

test("real CLI exports and checks a second theme without changing installed Realness", t => {
  const output = scratch(t)
  const installed = read_file_sync(join(root, ".pi/agent/themes/realness-dark.json"), "utf8")
  const args = ["--theme", "example-client", "--out", output]
  const result = cli(...args)
  assert.equal(result.status, 0, result.stderr)
  const files = render_theme(load_theme(join(root, "apps/realness/themes/example-client"), "example-client"))
  assert.equal(files.size, 7)
  for (const [relative, content] of files) assert.equal(read_file_sync(join(output, relative), "utf8"), content)
  const realness = render_theme(load_theme(join(root, "apps/realness/themes/realness"), "realness"))
  assert.notEqual(files.get("web/color.css"), realness.get("web/color.css"))
  const client_pi = JSON.parse(files.get("pi/example-client-dark.json"))
  assert.equal(client_pi.vars.accent, "#9065d0")
  assert.match(files.get("ghostty/example-client-dark"), /palette = 2=#9065d0/)
  assert.match(files.get("nvim/example-client.lua"), /base0B = "#9065d0"/)
  assert.equal(cli(...args, "--check").status, 0)
  const changed = join(output, "ghostty/example-client-dark")
  write_file_sync(changed, "stale")
  assert.equal(cli(...args, "--check").status, 1)
  assert.equal(read_file_sync(changed, "utf8"), "stale")
  assert.equal(read_file_sync(join(root, ".pi/agent/themes/realness-dark.json"), "utf8"), installed)
})

test("missing or invalid client input fails before writing outputs", t => {
  const directory = scratch(t)
  cp_sync(join(root, "apps/realness/themes/example-client"), join(directory, "themes/example-client"), { recursive: true })
  const path = join(directory, "themes/example-client/roles.json")
  const mapping = JSON.parse(read_file_sync(path, "utf8"))
  delete mapping.dark.accent
  write_file_sync(path, JSON.stringify(mapping))
  assert.throws(() => load_theme(join(directory, "themes/example-client"), "example-client"), /missing dark role: accent/)
  mapping.dark.accent = "missing-material"
  write_file_sync(path, JSON.stringify(mapping))
  assert.throws(() => load_theme(join(directory, "themes/example-client"), "example-client"), /unknown material/)
  assert.equal(cli("--theme", "example-client").status, 1)
  assert.equal(cli("--theme", "../realness", "--out", directory).status, 1)
  assert.equal(cli("--out", "../outside-brayness").status, 1)
  const absent = join(directory, "absent")
  assert.equal(cli("--theme", "example-client", "--out", absent, "--check").status, 1)
  assert.equal(exists_sync(absent), false)
})

test("Ghostty links repair a moved checkout and keep a user's own theme file", t => {
  const home = scratch(t)
  const directory = join(home, ".config/ghostty/themes")
  mkdir_sync(directory, { recursive: true })
  symlink_sync("/old/checkout/realness-dark", join(directory, "realness-dark"))
  write_file_sync(join(directory, "realness-light"), "mine")
  link_ghostty({ root, home })
  assert.equal(readlink_sync(join(directory, "realness-dark")), relative(directory, join(root, "apps/realness/src/app/terminal/themes/realness-dark")))
  assert.equal(read_file_sync(join(directory, "realness-light"), "utf8"), "mine")
  rm_sync(join(directory, "realness-light"))
  link_ghostty({ root, home })
  assert.match(read_file_sync(join(directory, "realness-light"), "utf8"), /^# realness light/)
})
