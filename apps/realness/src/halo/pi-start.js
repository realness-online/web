/** Start the terminal process, asking again each second until Pi stays alive across two checks. */
export const pi_start_argv = initializer => [
  '/bin/sh',
  '-c',
  '"$0" "$@" || exit $?; ' +
    'for attempt in $(seq 100); do ' +
    'if pgrep -x pi >/dev/null; then sleep 0.1; pgrep -x pi >/dev/null && exit 0; fi; ' +
    'case $attempt in *0) "$0" "$@" || exit $?;; esac; ' +
    'sleep 0.1; done; ' +
    'echo "Pi did not start in the terminal" >&2; exit 1',
  initializer,
  'start-pi'
]
