import { MAX_PIXEL_RATIO } from './renderer-config.js'

/**
 * @param {{
 *   canvas: HTMLCanvasElement
 *   on_resize: (state: { width: number, height: number, pixel_ratio: number }) => void
 * }} options
 */
export const create_resize_observer = options => {
  const { canvas, on_resize } = options
  const pixel_ratio = () =>
    Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)

  const sync_now = () => {
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    on_resize({ width, height, pixel_ratio: pixel_ratio() })
  }

  const resize_observer = new ResizeObserver(() => sync_now())

  return {
    start() {
      resize_observer.observe(canvas)
      sync_now()
    },
    stop() {
      resize_observer.disconnect()
    },
    sync_now
  }
}
