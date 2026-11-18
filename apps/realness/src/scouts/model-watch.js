/** How long a model call may send nothing before the run says so. */
const QUIET_MS = 20_000
/** How often a streaming model call reports its size. */
const EVERY_MS = 15_000
const MS_PER_SECOND = 1000

/** @param {number} ms */
const seconds = ms => `${Math.round(ms / MS_PER_SECOND)}s`

/**
 * The model's side of a run, said as it happens: asked, first byte, still
 * streaming, quiet, and how the call ended. It reports and decides nothing;
 * a run ends only on an error a hop names.
 * @param {object} options
 * @param {(line: string) => void} options.say
 * @param {() => number} [options.now]
 * @param {number} [options.quiet_ms]
 * @param {number} [options.every_ms]
 */
export const model_watch = ({
  say,
  now = Date.now,
  quiet_ms = QUIET_MS,
  every_ms = EVERY_MS
}) => {
  /** @type {{ asked: number, last: number, told: number, chars: number, first: number } | null} */
  let call = null
  return {
    /** @param {Record<string, any>} event one pi event */
    event(event) {
      const role = event.message?.role
      if (event.type === 'message_start' && role === 'assistant') {
        call = { asked: now(), last: now(), told: now(), chars: 0, first: 0 }
        say('model  asked')
        return
      }
      if (!call) return
      if (event.type === 'message_update') {
        const delta = event.assistantMessageEvent?.delta
        if (typeof delta !== 'string') return
        call.chars += delta.length
        call.last = now()
        if (!call.first) {
          call.first = call.last
          say(`model  first byte after ${seconds(call.first - call.asked)}`)
        }
        return
      }
      if (event.type === 'message_end' && role === 'assistant') {
        const took = seconds(now() - call.asked)
        say(
          event.message.stopReason === 'error'
            ? `model  ended after ${took}: ${event.message.errorMessage ?? 'an error with no message'}`
            : `model  done, ${call.chars} chars in ${took}`
        )
        call = null
      }
    },
    tick() {
      if (!call) return
      const at = now()
      if (at - call.last >= quiet_ms && at - call.told >= quiet_ms) {
        call.told = at
        say(`model  no bytes for ${seconds(at - call.last)}`)
        return
      }
      if (call.first && at - call.told >= every_ms) {
        call.told = at
        say(`model  streaming, ${call.chars} chars`)
      }
    }
  }
}
