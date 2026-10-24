#!/usr/bin/env node
import { existsSync as exists_sync, lstatSync as lstat_sync, mkdirSync as mkdir_sync, readFileSync as read_file_sync, readlinkSync as readlink_sync, rmSync as rm_sync, symlinkSync as symlink_sync, writeFileSync as write_file_sync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath as file_url_to_path } from "node:url"
import { load_theme, theme_name } from "../../apps/realness/themes/load.js"
import { ghostty } from "../../apps/realness/themes/adapters/ghostty.js"
import { pi } from "../../apps/realness/themes/adapters/pi.js"
import { nvim } from "../../apps/realness/themes/adapters/nvim.js"
import { emacs } from "../../apps/realness/themes/adapters/emacs.js"
import { web } from "../../apps/realness/themes/adapters/web.js"

const ROOT = resolve(dirname(file_url_to_path(import.meta.url)), "../..")

/** Render every format before writing anything. Export never selects or installs. */
export const render_theme = theme => {
  const { name, palette, schemes } = theme
  return new Map([
    ["web/palette.css", palette], ["web/color.css", web(schemes)],
    ...["light", "dark"].flatMap(scheme => [
      [`ghostty/${name}-${scheme}`, ghostty(schemes[scheme])],
      [`pi/${name}-${scheme}.json`, JSON.stringify(pi(schemes[scheme]), null, 2) + "\n"],
      [`emacs/${name}-${scheme}-theme.el`, emacs(schemes[scheme])],
    ]),
    [`nvim/${name}.lua`, nvim(name, schemes)],
  ])
}

/** Default destinations preserve existing consumers and Ghostty symlinks. */
const installed_paths = new Map([
  ["web/palette.css", "apps/realness/src/app/style/palette.css"],
  ["web/color.css", "apps/realness/src/app/style/color.css"],
  ...["light", "dark"].flatMap(scheme => [
    [`ghostty/realness-${scheme}`, `apps/realness/src/app/terminal/themes/realness-${scheme}`],
    [`pi/realness-${scheme}.json`, `.pi/agent/themes/realness-${scheme}.json`],
    [`emacs/realness-${scheme}-theme.el`, `work/doom/themes/realness-${scheme}-theme.el`],
  ]),
  ["nvim/realness.lua", "work/nvim/colors/realness.lua"],
])

export const generate = ({ root = ROOT, name = "realness", output, check = false } = {}) => {
  theme_name(name)
  if (name !== "realness" && !output) throw new Error("client themes require --out; export does not install")
  const destination = output ? resolve(root, output) : root
  if (destination !== root && !destination.startsWith(root + "/")) throw new Error("output must stay inside realness")
  const files = render_theme(load_theme(join(root, "apps/realness/themes", name), name))
  let stale = 0
  for (const [relative, want] of files) {
    if (!output && relative.startsWith("nvim/") && !exists_sync(join(root, "work/nvim"))) continue
    if (!output && relative.startsWith("emacs/") && !exists_sync(join(root, "work/doom"))) continue
    const path = output ? join(destination, relative) : join(root, installed_paths.get(relative))
    if (exists_sync(path) && read_file_sync(path, "utf8") === want) continue
    if (check) {
      console.error(`stale: ${path}; run npm run palette`)
      stale++
    } else {
      mkdir_sync(dirname(path), { recursive: true })
      write_file_sync(path, want)
      console.log(`wrote ${path}`)
    }
  }
  return stale
}

/** Ghostty loads themes by name from ~/.config/ghostty/themes. A regular file there belongs to the user and stays. */
export const link_ghostty = ({ root = ROOT, home = homedir() } = {}) => {
  const directory = join(home, ".config/ghostty/themes")
  mkdir_sync(directory, { recursive: true })
  for (const scheme of ["light", "dark"]) {
    const link = join(directory, `realness-${scheme}`)
    const target = relative(directory, join(root, installed_paths.get(`ghostty/realness-${scheme}`)))
    const stat = lstat_sync(link, { throwIfNoEntry: false })
    if (stat && !stat.isSymbolicLink()) {
      console.log(`kept ${link}; not a link`)
      continue
    }
    if (stat && readlink_sync(link) === target) continue
    if (stat) rm_sync(link)
    symlink_sync(target, link)
    console.log(`linked ${link}`)
  }
}

export const main = () => {
  const args = process.argv.slice(2)
  const options = {}
  while (args.length) {
    const arg = args.shift()
    if (arg === "--check") options.check = true
    else if (arg === "--theme" || arg === "--out") {
      const value = args.shift()
      if (!value || value.startsWith("--")) throw new Error(`missing value: ${arg}`)
      options[arg === "--theme" ? "name" : "output"] = value
    } else throw new Error(`unknown argument: ${arg}`)
  }
  process.exitCode = generate(options) ? 1 : 0
  if (!options.check && !options.output) link_ghostty()
}

if (process.argv[1] === file_url_to_path(import.meta.url)) main()
