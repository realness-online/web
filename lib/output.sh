# Where generated files go; the shell twin of lib/output.js. Source it, then
# use "$OUT". BRAYNESS_OUT wins; inside a harness it is the harness's
# artifacts/brayness; on a host it is dist/ beside the code.
_out_project="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -n "${BRAYNESS_OUT:-}" ]; then
  OUT="$BRAYNESS_OUT"
elif [ -d "$_out_project/../../artifacts" ]; then
  OUT="$(cd "$_out_project/../../artifacts" && pwd)/brayness"
else
  OUT="$_out_project/dist"
fi
mkdir -p "$OUT"
export OUT
unset _out_project
