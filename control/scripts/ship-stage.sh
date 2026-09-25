#!/usr/bin/env bash
# One source tree for the hosted image and the handed-out binary.
set -euo pipefail

project="$(cd "$(dirname "$0")/../.." && pwd)"
root="$(cd "$project/../.." && pwd)"
stage="$project/dist/ship"

# Capture the same executable the local TUI uses, once for this ship tree.
command -v pi > /dev/null || { echo "pi is not installed on PATH" >&2; exit 1; }
pi_version="$(pi --version)"
[[ "$pi_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]] || {
  echo "invalid local pi version: $pi_version" >&2
  exit 1
}

rm -rf "$stage"
mkdir -p "$stage"
printf '%s\n' "$pi_version" > "$stage/.pi-version"

# The harness is an allowlist. Do not copy personal config, sessions, or work/.
include=(AGENTS.md README.md LICENSE package.json bin skills prompts extensions
  .pi/agent/settings.json .pi/agent/models.json .pi/agent/subagents.json
  .pi/agent/npm/package.json)
[[ ! -d "$root/themes" ]] || include+=(themes)
tar -C "$root" -cf - --no-mac-metadata \
  --exclude='.DS_Store' --exclude='._*' --exclude='node_modules' \
  "${include[@]}" | tar -C "$stage" -xf -
# Pi discovers local extensions from its agent directory. Keep the same link
# as the dev harness without copying the extensions a second time.
ln -s ../../extensions "$stage/.pi/agent/extensions"
# Prompt templates (/site, /app) load from the agent directory too.
ln -s ../../prompts "$stage/.pi/agent/prompts"

# The Mac's model list names logins the ship tree does not carry. Shipped Pi
# talks to one model: the realness proxy, which picks the real one.
# Packages a shipped harness cannot use cost startup seconds on two vCPUs:
# the proxy is the only model (oauth), no MCP servers ship (mcp), subagents run
# in their own microVMs (plans/brayness.md), and usage reports proxy calls.
node -e '
  const fs = require("fs"), [settings_path, npm_path] = process.argv.slice(1)
  const unshipped = ["pi-claude-oauth-adapter", "pi-mcp-adapter", "pi-subagents-j0k3r", "pi-mono-usage"]
  const settings = JSON.parse(fs.readFileSync(settings_path))
  settings.defaultProvider = "realness"
  settings.defaultModel = "inkling"
  settings.enabledModels = ["realness/inkling"]
  settings.packages = settings.packages.filter(p => !unshipped.includes(p.replace(/^npm:/, "")))
  fs.writeFileSync(settings_path, JSON.stringify(settings, null, 2) + "\n")
  const npm = JSON.parse(fs.readFileSync(npm_path))
  for (const name of unshipped) delete npm.dependencies[name]
  fs.writeFileSync(npm_path, JSON.stringify(npm, null, 2) + "\n")
' "$stage/.pi/agent/settings.json" "$stage/.pi/agent/npm/package.json"

# The ship tree keeps the dev layout: examples under work/brayness, the packages
# under work/realness, so the app's relative links resolve the same everywhere.
# Examples are source only. Dependencies are installed by the session.
mkdir -p "$stage/work/brayness"
tar -C "$project" -cf - --no-mac-metadata \
  --exclude='node_modules' --exclude='._*' --exclude='.DS_Store' \
  --exclude='smoke-staging-project.png' --exclude='page.png' --exclude='data' \
  --exclude='dist' --exclude='package-lock.json' examples/site examples/app | tar -C "$stage/work/brayness" -xf -
for package in itemid store; do
  mkdir -p "$stage/work/realness/packages/$package"
  cp "$root/work/realness/packages/$package/package.json" "$stage/work/realness/packages/$package/"
  cp -R "$root/work/realness/packages/$package/src" "$stage/work/realness/packages/$package/"
done

printf 'ship tree: %s\n' "$stage"
