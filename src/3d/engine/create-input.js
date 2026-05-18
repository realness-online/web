import { bind_device_orientation } from './bind-device-orientation.js'

/**
 * @param {{ canvas: HTMLCanvasElement }} options
 */
export const create_input = options => {
  const { canvas } = options
  const state = {
    pointer_dx: 0,
    pointer_dy: 0,
    pan_wheel_x: 0,
    pan_wheel_y: 0,
    wheel_delta: 0,
    pointer_x_norm: 0,
    pointer_y_norm: 0,
    arrow_x: 0,
    arrow_y: 0,
    gyro_x: 0,
    gyro_y: 0,
    shift_held: false,
    alt_held: false,
    cmd_held: false
  }

  let last_x = 0
  let last_y = 0
  const arrow_keys = new Set()

  const update_norm = event => {
    const rect = canvas.getBoundingClientRect()
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1
    state.pointer_x_norm = Math.max(-1, Math.min(1, nx))
    state.pointer_y_norm = Math.max(-1, Math.min(1, ny))
  }

  const on_pointer_down = event => {
    last_x = event.clientX
    last_y = event.clientY
    canvas.setPointerCapture(event.pointerId)
  }

  const on_pointer_move = event => {
    update_norm(event)
    const next_x = event.clientX
    const next_y = event.clientY
    state.pointer_dx += next_x - last_x
    state.pointer_dy += next_y - last_y
    last_x = next_x
    last_y = next_y
  }

  const on_pointer_up = event => {
    canvas.releasePointerCapture(event.pointerId)
  }

  const on_wheel = event => {
    if (state.shift_held) {
      event.preventDefault()
      state.pan_wheel_x += event.deltaX || event.deltaY
      return
    }
    if (state.alt_held) {
      event.preventDefault()
      state.pan_wheel_y += event.deltaY || event.deltaX
      return
    }
    if (state.cmd_held) {
      event.preventDefault()
      state.wheel_delta += event.deltaY
    }
  }

  const refresh_arrow_state = () => {
    const left = arrow_keys.has('ArrowLeft') ? -1 : 0
    const right = arrow_keys.has('ArrowRight') ? 1 : 0
    const up = arrow_keys.has('ArrowUp') ? 1 : 0
    const down = arrow_keys.has('ArrowDown') ? -1 : 0
    state.arrow_x = left + right
    state.arrow_y = up + down
  }

  const is_arrow = key =>
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown'

  const on_key_down = event => {
    if (event.key === 'Shift') state.shift_held = true
    if (event.key === 'Alt') state.alt_held = true
    if (event.key === 'Meta') state.cmd_held = true
    if (!is_arrow(event.key)) return
    arrow_keys.add(event.key)
    refresh_arrow_state()
    event.preventDefault()
  }

  const on_key_up = event => {
    if (event.key === 'Shift') state.shift_held = false
    if (event.key === 'Alt') state.alt_held = false
    if (event.key === 'Meta') state.cmd_held = false
    if (!is_arrow(event.key)) return
    arrow_keys.delete(event.key)
    refresh_arrow_state()
  }

  const on_blur = () => {
    state.shift_held = false
    state.alt_held = false
    state.cmd_held = false
    arrow_keys.clear()
    refresh_arrow_state()
  }

  bind_device_orientation({ canvas, state })

  canvas.addEventListener('pointerdown', on_pointer_down)
  canvas.addEventListener('pointermove', on_pointer_move)
  canvas.addEventListener('pointerup', on_pointer_up)
  canvas.addEventListener('pointercancel', on_pointer_up)
  canvas.addEventListener('wheel', on_wheel, { passive: false })
  window.addEventListener('keydown', on_key_down)
  window.addEventListener('keyup', on_key_up)
  window.addEventListener('blur', on_blur)

  return {
    state,
    reset_frame_deltas() {
      state.pointer_dx = 0
      state.pointer_dy = 0
      state.wheel_delta = 0
      state.pan_wheel_x = 0
      state.pan_wheel_y = 0
    }
  }
}
