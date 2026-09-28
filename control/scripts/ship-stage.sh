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

# The harness is an allowlist. Do not copy personal config, actors, or work/.
# The published mirror lives inside the sync skill and is excluded by name:
# it is a filtered copy of this tree, and shipping it would carry its .git.
include=(AGENTS.md README.md LICENSE package.json bin skills prompts extensions
  .pi/agent/settings.json .pi/agent/models.json
  .pi/agent/npm/package.json)
[[ ! -d "$root/themes" ]] || include+=(themes)
tar -C "$root" -cf - --no-mac-metadata \
  --exclude='.DS_Store' --exclude='._*' --exclude='node_modules' \
  --exclude='skills/brayness-sync/published' \
  "${include[@]}" | tar -C "$stage" -xf -
# Pi discovers local extensions from its agent directory. Keep the same link
# as the dev harness without copying the extensions a second time.
ln -s ../../extensions "$stage/.pi/agent/extensions"
# Prompt templates (/site, /app) load from the agent directory too.
ln -s ../../prompts "$stage/.pi/agent/prompts"

# The ship tree names its own one provider; the Mac's model list stays local.
# Shipped Pi asks its host door for a person-bound pass on each proxy call.
proxy_url="${BRAYNESS_PROXY_URL:-https://brayness-proxy-yelzvhhngq-uc.a.run.app}"
[[ "$proxy_url" =~ ^https?://[^/[:space:]]+(/[^[:space:]]*)?$ ]] || {
  echo "BRAYNESS_PROXY_URL must be an http(s) endpoint" >&2
  exit 1
}
# Packages a shipped harness cannot use cost startup seconds on two vCPUs:
# no MCP servers ship (mcp), long work runs as autoresearch loops, never
# subagents (plans/brayness.md), and usage reports proxy calls. The Claude
# OAuth adapter does ship: the proxy is the default model, and a person may
# sign in with a subscription instead.
node -e '
  const fs = require("fs"), [settings_path, npm_path, models_path, proxy_url] = process.argv.slice(1)
  const unshipped = ["pi-mcp-adapter", "pi-subagents-j0k3r", "pi-mono-usage"]
  const settings = JSON.parse(fs.readFileSync(settings_path))
  settings.defaultProvider = "brayness"
  settings.defaultModel = "inkling"
  // No enabledModels: the Mac list must not ship, and Pi cycles every
  // authenticated model when the pattern list is absent.
  delete settings.enabledModels
  settings.packages = settings.packages.filter(p => !unshipped.includes(p.replace(/^npm:/, "")))
  fs.writeFileSync(settings_path, JSON.stringify(settings, null, 2) + "\n")
  const npm = JSON.parse(fs.readFileSync(npm_path))
  for (const name of unshipped) delete npm.dependencies[name]
  fs.writeFileSync(npm_path, JSON.stringify(npm, null, 2) + "\n")
  const models = JSON.parse(fs.readFileSync(models_path))
  models.providers = { brayness: {
    baseUrl: proxy_url,
    apiKey: "!brayness-model-pass",
    api: "openai-completions",
    compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
    models: [{
      id: "inkling",
      name: "Inkling (brayness proxy)",
      input: ["text"],
      contextWindow: 1048576,
      maxTokens: 32768,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }],
  } }
  fs.writeFileSync(models_path, JSON.stringify(models, null, 2) + "\n")
' "$stage/.pi/agent/settings.json" "$stage/.pi/agent/npm/package.json" "$stage/.pi/agent/models.json" "$proxy_url"

# Examples are not shipped: actors download them from brayness-examples with
# giget when a prompt asks, and install @realness.online packages from npm.

printf 'ship tree: %s\n' "$stage"
