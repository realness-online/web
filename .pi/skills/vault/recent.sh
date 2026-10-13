#!/usr/bin/env bash

set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
VAULT=${VAULT:-$here/../../vault}
[ -d "$VAULT" ] || { echo "no vault at $VAULT" >&2; exit 1; }
cd "$VAULT" || exit 1

newest() {
  local count=$1; shift
  find "$@" -name '*.md' -not -name ':feed.md' -not -path '*/.obsidian/*' -not -path '*/.git/*' \
    -exec stat -f '%m %Sm %N' {} + 2>/dev/null | sort -rn | head -"$count" | cut -d' ' -f2-
}

echo "== journal (last 40 lines)"
for journal in "journal/Journal.md" "journal/Journal $(date +%Y).md"; do
  [ -f "$journal" ] && { echo "-- $journal"; tail -40 "$journal"; }
done

echo; echo "== recently changed"
newest 30 .

for section in "Projects" "Areas" "Resources"; do
  echo; echo "== newest in $section"
  newest 10 "$section"
done

echo; echo "== inboxes (last 30 days)"
find Clippings Unsorted -name '*.md' -mtime -30 2>/dev/null | sort

echo; echo "== project status notes"
for project in "Projects"/*/; do
  notes=$(ls "$project" | grep -i -E 'todo|release|log|status|notes|update' | head -5)
  [ -n "$notes" ] && printf '%s\n%s\n' "-- $(basename "$project")" "$notes"
done
exit 0
