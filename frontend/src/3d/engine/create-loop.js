const MS_PER_SECOND = 1000
const MAX_DELTA_FPS = 15

/**
 * @param {{ tick: (frame_state: import('@/3d/engine/types.js').FrameState) => void }} options
 */
export const create_loop = options => {
  const { tick } = options

  let raf_id = 0
  let started = false
  let last_ms = 0
  let elapsed_s = 0

  const frame = now_ms => {
    if (!started) return
    if (!last_ms) last_ms = now_ms
    const delta_s = Math.min(
      (now_ms - last_ms) / MS_PER_SECOND,
      1 / MAX_DELTA_FPS
    )
    last_ms = now_ms
    elapsed_s += delta_s
    const fps = delta_s > 0 ? 1 / delta_s : 0
    tick({ now_ms, delta_s, elapsed_s, fps })
    raf_id = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (started) return
      started = true
      raf_id = requestAnimationFrame(frame)
    },
    stop() {
      started = false
      if (raf_id) cancelAnimationFrame(raf_id)
      raf_id = 0
      last_ms = 0
    }
  }
}
