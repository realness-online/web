_out_project="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$(node "$_out_project/src/settings/cli.js" output --root "$_out_project")" || return $?
mkdir -p "$OUT"
export OUT
unset _out_project
