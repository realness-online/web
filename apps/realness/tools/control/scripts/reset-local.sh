#!/usr/bin/env bash
# A guaranteed-fresh local stack: tear down the Lima VM, rebuild the template
# from the current checkout, and start clean. The VM is the only persistent
# sink (mounts, actors, seed), so deleting it removes every previous build.
# Never touches iCloud data (Realness-sync-2 is the store). Ctrl-C stops the
# stack it starts; calling the script again rebuilds from scratch. Staging
# resolves `pi` from PATH, so the repo's own launcher goes first.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$DIR/../../.." && pwd)"
ROOT="$(cd "$APP/../.." && pwd)"
export PATH="$ROOT/.pi/bin:$PATH"

echo "==> stopping the local stack"
pkill -INT -f 'harness/local\.js' 2>/dev/null || true
sleep 6

echo "==> tearing down the halo and Lima VM"
cd "$APP"
npm run realness -- local halo down lima-fc-local --delete --vm 2>/dev/null || true
limactl delete -f -y fc-local 2>/dev/null || true

echo "==> fresh VM from the current config"
npm run realness -- local setup

echo "==> fresh template from the current checkout"
npm run realness -- local build

echo "==> clearing the build tree on the fresh VM"
limactl shell fc-local -- sudo rm -rf /opt/fc/template-tree 2>/dev/null || true

echo "==> starting the stack (Ctrl-C to stop)"
cd "$ROOT"
npm run local