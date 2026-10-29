/** Start the terminal process, asking again every second until Pi stays alive
 * across two checks. The window matches the actor-ready budget (~60 s): a cold
 * Pi on a slow host can take far longer than a few seconds to appear. */
export const pi_start_argv = initializer => [
  '/bin/sh',
  '-c',
  '"$0" "$@" || exit $?; ' +
    'for attempt in $(seq 600); do ' +
    'if pgrep -x pi >/dev/null; then sleep 0.1; pgrep -x pi >/dev/null && exit 0; fi; ' +
    'case $attempt in *0) "$0" "$@" || exit $?;; esac; ' +
    'sleep 0.1; done; ' +
    'echo "Pi did not start in the terminal" >&2; exit 1',
  initializer,
  'start-pi'
]
