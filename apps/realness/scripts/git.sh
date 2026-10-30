#!/bin/sh
# git for the app wherever its repository lives: a normal checkout, or the
# Realness root, whose repository is work/realness.git with core.worktree.
if git rev-parse --git-dir > /dev/null 2>&1; then exec git "$@"; fi
root="$(cd "$(dirname "$0")/../../.." && pwd)"
exec git --git-dir="$root/work/realness.git" "$@"
