/** @typedef {import('@/types').Id} Id */
import {
  Output,
  MovOutputFormat,
  BufferTarget,
  StreamTarget,
  CanvasSource
} from 'mediabunny'
import {
  FRAMES_PER_SECOND,
  BASE_DURATION,
  ANIMATION_SPEED_MULTIPLIERS
} from '@/utils/animation-config'

// Video encoding constants
const DEFAULT_FPS = 24
// Each rendered frame (sampled at FRAMES_PER_SECOND) is repeated this many
// times during encoding, so the output is a standard 24fps file but paces
// like ~2x real-time (24 / FRAME_HOLD = 6 unique poses/sec) instead of the
// distractingly-fast ~8x you'd get from encoding one rendered frame per
// 24fps tick with no hold.
const FRAME_HOLD = 4
// Bitrate is a fixed bits-per-second target, not tied to resolution, so it
// needs to scale with the canvas pixel count to keep the same bits-per-pixel
// density — otherwise a bigger canvas just spreads the same bit budget over
// more pixels instead of looking sharper. 14 Mbps matches the ~1.8x pixel
// increase from 1080p (8 Mbps) to the current 1440p export target.
const VIDEO_BITRATE = 14000000
const BYTES_PER_KB = 1024
const CHUNK_SIZE_MB = 2
const PROGRESS_HALF = 0.5
const EASE_BEZIER_ITERATIONS = 12
const EASE_BEZIER_TOLERANCE = 1e-6
const KEY_SPLINE_PARTS = 4

/**
 * @typedef {Object} VideoEncoderConfig
 * @property {string} codec - Codec string (e.g., 'vp09.00.10.08', 'vp8')
 * @property {number} width - Video width in pixels
 * @property {number} height - Video height in pixels
 * @property {number} bitrate - Bitrate in bits per second
 * @property {number} framerate - Frame rate in frames per second
 */

/**
 * @typedef {Object} EncodedVideoChunk
 * @property {Uint8Array} data - Encoded video data
 * @property {number} timestamp - Timestamp in microseconds
 * @property {string} type - Chunk type ('key' or 'delta')
 * @property {number} duration - Duration in microseconds
 */

/**
 * @typedef {typeof globalThis.VideoEncoder} VideoEncoder
 * @typedef {typeof globalThis.VideoFrame} VideoFrame
 */

/**
 * Calculates animation duration based on animation speed preference
 * @param {string} animation_speed - See ANIMATION_SPEEDS in animation-config
 * @returns {number} Duration in seconds
 */
const get_animation_duration = animation_speed => {
  const multiplier = ANIMATION_SPEED_MULTIPLIERS[animation_speed] || 1
  return BASE_DURATION * multiplier
}

/**
 * Setup File System Access API for direct file writing
 * @param {string|undefined} suggested_filename - Suggested filename
 * @returns {Promise<{file_handle: any, writable_stream: any}>}
 */
const setup_file_system_api = async suggested_filename => {
  const use_file_system_api = 'showSaveFilePicker' in window

  if (!use_file_system_api) return { file_handle: null, writable_stream: null }

  if (!suggested_filename) return { file_handle: null, writable_stream: null }

  try {
    const file_handle = await /** @type {any} */ (window).showSaveFilePicker({
      suggestedName: suggested_filename,
      types: [
        {
          description: 'QuickTime Video',
          accept: { 'video/quicktime': ['.mov'] }
        }
      ]
    })
    const writable_stream = await file_handle.createWritable()
    return { file_handle, writable_stream }
  } catch (error) {
    const has_abort =
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
    if (!has_abort)
      console.warn(
        '[Video] File System Access API error, using memory buffer:',
        error
      )
    return { file_handle: null, writable_stream: null }
  }
}

/**
 * Setup canvas and video encoder
 * @param {number} canvas_width - Canvas width
 * @param {number} canvas_height - Canvas height
 * @param {number} fps - Frames per second
 * @param {number} total_frames - Total number of frames
 * @param {any} writable_stream - Optional writable stream for File System API
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, output: any, canvas_source: any}}
 */
const setup_canvas_and_encoder = (
  canvas_width,
  canvas_height,
  fps,
  total_frames,
  writable_stream
) => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas_width
  canvas.height = canvas_height
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('Failed to get 2d context')

  const target = writable_stream
    ? new StreamTarget(writable_stream, {
        chunked: true,
        chunkSize: CHUNK_SIZE_MB * BYTES_PER_KB * BYTES_PER_KB
      })
    : new BufferTarget()

  const output = new Output({
    format: new MovOutputFormat(),
    target
  })

  let canvas_source = null
  try {
    canvas_source = new CanvasSource(canvas, {
      codec: 'avc',
      bitrate: VIDEO_BITRATE,
      keyFrameInterval: 1.25,
      latencyMode: 'quality'
    })
  } catch {
    throw new Error('H.264 codec not supported - required for MOV format')
  }

  output.addVideoTrack(canvas_source, {
    frameRate: fps,
    maximumPacketCount: total_frames
  })

  return { canvas, ctx, output, canvas_source }
}

const parse_dur = dur_str => {
  if (!dur_str) return 1
  return parseFloat(String(dur_str).replace('s', '')) || 1
}

const cubic_bezier_at = (t, p1x, p1y, p2x, p2y) => {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3,
    y: 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3
  }
}

const ease_bezier = (t, p1x, p1y, p2x, p2y) => {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < EASE_BEZIER_ITERATIONS; i++) {
    const mid = (lo + hi) / 2
    const pt = cubic_bezier_at(mid, p1x, p1y, p2x, p2y)
    if (Math.abs(pt.x - t) < EASE_BEZIER_TOLERANCE) return pt.y
    if (pt.x < t) lo = mid
    else hi = mid
  }
  return cubic_bezier_at((lo + hi) / 2, p1x, p1y, p2x, p2y).y
}

const parse_key_times = str => {
  if (!str) return null
  return str
    .split(';')
    .map(v => parseFloat(v.trim()))
    .filter(n => !isNaN(n))
}

const parse_key_splines = str => {
  if (!str) return null
  return str
    .split(';')
    .map(segment => {
      const parts = segment.trim().split(/\s+/).map(parseFloat)
      return parts.length === KEY_SPLINE_PARTS ? parts : null
    })
    .filter(Boolean)
}

const apply_animation_state = (svg_element, current_time) => {
  const animate_elements = svg_element.querySelectorAll('animate')
  animate_elements.forEach(anim => {
    const dur = parse_dur(anim.getAttribute('dur'))
    const values_str = anim.getAttribute('values')
    const attribute_name = anim.getAttribute('attributeName')
    const href = anim.getAttribute('href') || anim.getAttribute('xlink:href')

    if (!values_str || !attribute_name || !href) return

    const target_id = href.replace(/^#/, '')
    let target = svg_element.querySelector(`[id="${target_id}"]`)
    if (!target && target_id.includes('-')) {
      const parts = target_id.split('-')
      const last = parts.pop()
      const shadows_id = [...parts, 'shadows', last].join('-')
      target = svg_element.querySelector(`[id="${shadows_id}"]`)
    }
    if (!target) return

    const values = values_str.split(';').map(v => v.trim())
    if (values.length < 2) return

    const cycle_time = current_time % dur
    const progress = Math.min(cycle_time / dur, 1)
    const key_times = parse_key_times(
      anim.getAttribute('keyTimes') || anim.getAttribute('keytimes')
    )
    const key_splines_raw =
      anim.getAttribute('keySplines') || anim.getAttribute('keysplines')
    const key_splines = parse_key_splines(key_splines_raw)

    const times =
      key_times && key_times.length === values.length
        ? key_times
        : values.map((_, i) => i / (values.length - 1))

    let value_index = times.length - 2
    let local_progress = 1
    for (let i = 0; i < times.length - 1; i++)
      if (progress <= times[i + 1]) {
        value_index = i
        const seg_dur = times[i + 1] - times[i]
        local_progress = seg_dur <= 0 ? 0 : (progress - times[i]) / seg_dur
        break
      }

    const spline = key_splines && key_splines[value_index]
    const eased_progress = spline
      ? ease_bezier(local_progress, spline[0], spline[1], spline[2], spline[3])
      : local_progress

    const current_value = values[value_index]
    const next_value = values[value_index + 1]
    if (!current_value || !next_value) return

    const current_num = parseFloat(current_value)
    const next_num = parseFloat(next_value)
    const unit = current_value.match(/%|px|em$/)?.[0] || ''

    if (!isNaN(current_num) && !isNaN(next_num)) {
      const interpolated =
        current_num + (next_num - current_num) * eased_progress
      target.setAttribute(attribute_name, `${interpolated}${unit}`)
    } else
      target.setAttribute(
        attribute_name,
        eased_progress < PROGRESS_HALF ? current_value : next_value
      )
  })

  animate_elements.forEach(el => el.remove())
}

/**
 * Rasterizes the SVG's animation state at a point in time to an Image,
 * without drawing it anywhere. Kept separate from drawing so a frame can be
 * cross-faded against its neighbor instead of only ever drawn on its own.
 * @param {SVGSVGElement} svg_element - SVG element to capture
 * @param {number} canvas_width - Canvas width
 * @param {number} canvas_height - Canvas height
 * @param {number} current_time - Current animation time
 * @returns {Promise<HTMLImageElement>}
 */
const rasterize_svg_frame = async (
  svg_element,
  canvas_width,
  canvas_height,
  current_time
) => {
  const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))
  svg_clone.setAttribute('width', String(canvas_width))
  svg_clone.setAttribute('height', String(canvas_height))

  const figure = svg_element.closest('figure:has([itemtype="/posters"])')
  if (figure) {
    const hidden_svg = figure.querySelector('svg[data-poster-symbol-defs]')
    if (hidden_svg) {
      const symbols = hidden_svg.querySelectorAll('symbol')
      symbols.forEach(symbol => {
        const symbol_clone = symbol.cloneNode(true)
        svg_clone.appendChild(symbol_clone)
      })
    }
  }

  const vue_components = svg_clone.querySelectorAll('as-animation')
  vue_components.forEach(el => el.replaceWith(...el.children))

  const stroke_dasharrays = {
    light: '8, 16',
    regular: '13, 21',
    medium: '18, 26',
    bold: '4, 32'
  }
  Object.entries(stroke_dasharrays).forEach(([itemprop, value]) => {
    svg_clone.querySelectorAll(`path[itemprop="${itemprop}"]`).forEach(path => {
      path.setAttribute('stroke-dasharray', value)
    })
  })

  apply_animation_state(svg_clone, current_time)

  const svg_data = new XMLSerializer().serializeToString(svg_clone)
  const svg_blob = new Blob([svg_data], { type: 'image/svg+xml' })
  const svg_url = URL.createObjectURL(svg_blob)

  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = svg_url
  })

  URL.revokeObjectURL(svg_url)
  img.onload = null
  img.onerror = null
  return img
}

/**
 * Draws a cross-fade between two already-rasterized frames onto the canvas.
 * `blend_t` of 0 shows `current_image` only; increasing it fades in
 * `next_image` on top, so motion between the two sparse samples reads as a
 * smooth transition instead of a hard hold.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {{width: number, height: number}} canvas_size - Canvas dimensions
 * @param {HTMLImageElement} current_image - Rasterized frame to fade from
 * @param {HTMLImageElement} next_image - Rasterized frame to fade toward
 * @param {number} blend_t - Blend factor in [0, 1)
 */
const draw_blended_frame = (
  ctx,
  { width, height },
  current_image,
  next_image,
  blend_t
) => {
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(current_image, 0, 0, width, height)
  if (blend_t > 0 && next_image !== current_image) {
    ctx.globalAlpha = blend_t
    ctx.drawImage(next_image, 0, 0, width, height)
    ctx.globalAlpha = 1
  }
}

/**
 * Downloads a video blob as a file
 * @param {Blob} blob - Video blob to download
 * @param {string} filename - Filename for the download
 */
export const download_video = (blob, filename = 'animation.mov') => {
  if (!blob) return

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Renders an SVG animation to a video blob at 24fps for download using parallel workers.
 * Frames are sampled at FRAMES_PER_SECOND and each is repeated FRAME_HOLD times during
 * encoding, so the output is a standard 24fps file that paces at ~2x real-time instead
 * of the ~8x speedup a naive one-rendered-frame-per-tick encoding would produce.
 * @param {SVGSVGElement} svg_element - The SVG element with animations
 * @param {Object} options - Configuration options
 * @param {number} [options.fps=24] - Target frames per second
 * @param {number} [options.max_duration] - Maximum animation duration in seconds (calculated from animation_speed if not provided)
 * @param {string} [options.animation_speed='normal'] - Animation speed preference
 * @param {number} [options.width] - Canvas width (defaults to SVG viewBox width)
 * @param {number} [options.height] - Canvas height (defaults to SVG viewBox height)
 * @param {Function} [options.on_progress] - Progress callback (frame, total_frames)
 * @param {string} [options.suggested_filename] - Suggested filename for File System Access API
 * @returns {Promise<Blob|null>} Video blob ready for download, or null if saved via File System Access API
 */
export const render_svg_to_video_blob = async (
  svg_element,
  {
    fps = DEFAULT_FPS,
    max_duration,
    animation_speed = 'normal',
    width,
    height,
    on_progress,
    suggested_filename
  } = {}
) => {
  if (!(svg_element instanceof SVGSVGElement))
    throw new Error('Element must be an SVGSVGElement')

  svg_element.pauseAnimations()

  const duration = max_duration || get_animation_duration(animation_speed)
  const { file_handle, writable_stream } =
    await setup_file_system_api(suggested_filename)

  const viewbox = svg_element.viewBox.baseVal
  let canvas_width = width || viewbox.width || svg_element.clientWidth
  let canvas_height = height || viewbox.height || svg_element.clientHeight

  canvas_width = canvas_width + (canvas_width % 2)
  canvas_height = canvas_height + (canvas_height % 2)

  const total_frames = Math.floor(duration * FRAMES_PER_SECOND) + 1
  const encoded_frame_count = total_frames * FRAME_HOLD

  const { ctx, output, canvas_source } = setup_canvas_and_encoder(
    canvas_width,
    canvas_height,
    fps,
    encoded_frame_count,
    writable_stream
  )

  await output.start()

  // oxlint-disable-next-line no-await-in-loop
  let current_image = await rasterize_svg_frame(
    svg_element,
    canvas_width,
    canvas_height,
    0
  )

  for (let current_frame = 0; current_frame < total_frames; current_frame++) {
    const is_last_frame = current_frame === total_frames - 1
    const next_time = (current_frame + 1) / FRAMES_PER_SECOND

    // Rasterize the next sample now so the held ticks below can cross-fade
    // toward it instead of holding the current pose rigidly — same number
    // of rasterizations as before (one per current_frame), just reused as
    // both the "current" and "next" endpoint across adjacent iterations.
    let next_image = current_image
    if (!is_last_frame)
      // oxlint-disable-next-line no-await-in-loop
      next_image = await rasterize_svg_frame(
        svg_element,
        canvas_width,
        canvas_height,
        next_time
      )

    const frame_duration = 1 / fps

    for (let hold = 0; hold < FRAME_HOLD; hold++) {
      const blend_t = hold / FRAME_HOLD
      draw_blended_frame(
        ctx,
        { width: canvas_width, height: canvas_height },
        current_image,
        next_image,
        blend_t
      )

      const encoded_frame_index = current_frame * FRAME_HOLD + hold
      const timestamp = encoded_frame_index / fps

      try {
        // oxlint-disable-next-line no-await-in-loop
        await canvas_source.add(timestamp, frame_duration)
      } catch (error) {
        console.error(
          `[Video] Error adding frame ${encoded_frame_index}:`,
          error
        )
        canvas_source.close()
        throw error
      }
    }

    current_image = next_image
    if (on_progress) on_progress(current_frame + 1, total_frames)
  }

  canvas_source.close()

  await output.finalize()

  if (writable_stream && file_handle) return null

  const buffer_target = /** @type {BufferTarget} */ (output.target)
  if (!buffer_target.buffer) throw new Error('Output buffer is null')
  const blob = new Blob([buffer_target.buffer], { type: 'video/quicktime' })

  return blob
}
