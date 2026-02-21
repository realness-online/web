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
const MAX_DURATION_SECONDS = BASE_DURATION
const MS_PER_SECOND = 1000
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
      bitrate: 2500000,
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

const find_stroke_use_for_path = (path_el, root) => {
  const path_id = path_el.getAttribute('id')
  if (!path_id) return null
  const href_matches = use_el =>
    (use_el.getAttribute('href') || use_el.getAttribute('xlink:href') || '') ===
      `#${path_id}` ||
    (use_el.getAttribute('href') || use_el.getAttribute('xlink:href') || '') ===
      `url(#${path_id})`
  const symbol = path_el.closest('symbol')
  return symbol
    ? [...symbol.querySelectorAll('use')].find(href_matches)
    : [...root.querySelectorAll('use')].find(href_matches)
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

    const is_stroke_attr =
      attribute_name === 'stroke-dashoffset' ||
      attribute_name === 'stroke-dasharray'
    if (is_stroke_attr && target.tagName === 'path') {
      const stroke_use = find_stroke_use_for_path(target, svg_element)
      if (stroke_use) target = stroke_use
    }

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
 * Capture a single SVG frame to canvas
 * @param {SVGSVGElement} svg_element - SVG element to capture
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} canvas_width - Canvas width
 * @param {number} canvas_height - Canvas height
 * @param {number} current_time - Current animation time
 * @returns {Promise<void>}
 */
const capture_svg_frame = async (
  svg_element,
  ctx,
  canvas_width,
  canvas_height,
  current_time
) => {
  const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))
  svg_clone.setAttribute('width', String(canvas_width))
  svg_clone.setAttribute('height', String(canvas_height))

  const figure = svg_element.closest('figure.poster')
  if (figure) {
    const hidden_svg = figure.querySelector('svg[style*="display: none"]')
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
      const stroke_use = find_stroke_use_for_path(path, svg_clone)
      if (stroke_use) stroke_use.setAttribute('stroke-dasharray', value)
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

  ctx.clearRect(0, 0, canvas_width, canvas_height)
  ctx.drawImage(img, 0, 0, canvas_width, canvas_height)

  URL.revokeObjectURL(svg_url)
  img.src = ''
  img.onload = null
  img.onerror = null
}

/**
 * Renders an SVG animation to a video element at 24fps
 * @param {SVGSVGElement} svg_element - The SVG element with animations
 * @param {Object} options - Configuration options
 * @param {number} [options.fps=24] - Target frames per second
 * @param {number} [options.max_duration=180] - Maximum animation duration in seconds
 * @param {number} [options.width] - Canvas width (defaults to SVG viewBox width)
 * @param {number} [options.height] - Canvas height (defaults to SVG viewBox height)
 * @returns {Promise<HTMLVideoElement>} Video element with the rendered animation
 */
export const render_svg_to_video = (
  svg_element,
  { fps = DEFAULT_FPS, max_duration = MAX_DURATION_SECONDS, width, height } = {}
) => {
  if (!(svg_element instanceof SVGSVGElement))
    throw new Error('Element must be an SVGSVGElement')

  const viewbox = svg_element.viewBox.baseVal
  const canvas_width = width || viewbox.width || svg_element.clientWidth
  const canvas_height = height || viewbox.height || svg_element.clientHeight

  const canvas = document.createElement('canvas')
  canvas.width = canvas_width
  canvas.height = canvas_height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2d context')

  const frame_duration = MS_PER_SECOND / fps
  const total_frames = Math.ceil(max_duration * fps)

  const stream = canvas.captureStream(fps)

  const mime_types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ]
  let mime_type = mime_types.find(type => MediaRecorder.isTypeSupported(type))
  if (!mime_type) mime_type = 'video/webm'

  const media_recorder = new MediaRecorder(stream, {
    mimeType: mime_type,
    videoBitsPerSecond: 2500000
  })

  const chunks = []
  media_recorder.ondataavailable = event => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const recording_promise = new Promise(resolve => {
    media_recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const video_url = URL.createObjectURL(blob)
      const video = document.createElement('video')
      video.src = video_url
      video.controls = true
      resolve(video)
    }
  })

  media_recorder.start()

  let current_frame = 0
  let current_time = 0

  const capture_frame = async () => {
    svg_element.setCurrentTime(current_time)

    await new Promise(resolve => {
      requestAnimationFrame(resolve)
    })

    const svg_data = new XMLSerializer().serializeToString(svg_element)
    const svg_blob = new Blob([svg_data], { type: 'image/svg+xml' })
    const svg_url = URL.createObjectURL(svg_blob)

    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = svg_url
    })

    ctx.clearRect(0, 0, canvas_width, canvas_height)
    ctx.drawImage(img, 0, 0, canvas_width, canvas_height)

    URL.revokeObjectURL(svg_url)

    current_frame++
    // eslint-disable-next-line require-atomic-updates
    current_time = (current_frame / fps) % max_duration

    if (current_frame < total_frames) setTimeout(capture_frame, frame_duration)
    else media_recorder.stop()
  }

  capture_frame()

  return recording_promise
}

/**
 * Renders an SVG animation to a canvas element at 24fps
 * @param {SVGSVGElement} svg_element - The SVG element with animations
 * @param {HTMLCanvasElement} canvas - Target canvas element
 * @param {Object} options - Configuration options
 * @param {number} [options.fps=24] - Target frames per second
 * @param {number} [options.max_duration=180] - Maximum animation duration in seconds
 * @param {Function} [options.on_frame] - Callback called for each frame
 * @returns {Promise<void>}
 */
export const render_svg_to_canvas = (
  svg_element,
  canvas,
  { fps = DEFAULT_FPS, max_duration = MAX_DURATION_SECONDS, on_frame } = {}
) => {
  if (!(svg_element instanceof SVGSVGElement))
    throw new Error('Element must be an SVGSVGElement')
  if (!(canvas instanceof HTMLCanvasElement))
    throw new Error('Canvas must be an HTMLCanvasElement')

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2d context')
  const frame_duration = MS_PER_SECOND / fps
  const total_frames = Math.ceil(max_duration * fps)

  let current_frame = 0
  let current_time = 0

  const capture_frame = async () => {
    svg_element.setCurrentTime(current_time)

    await new Promise(resolve => {
      requestAnimationFrame(resolve)
    })
    await new Promise(resolve => {
      requestAnimationFrame(resolve)
    })

    const svg_data = new XMLSerializer().serializeToString(svg_element)
    const svg_blob = new Blob([svg_data], { type: 'image/svg+xml' })
    const svg_url = URL.createObjectURL(svg_blob)

    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = svg_url
    })

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    URL.revokeObjectURL(svg_url)

    if (on_frame) on_frame(current_frame, current_time)

    current_frame++
    // eslint-disable-next-line require-atomic-updates
    current_time = (current_frame / fps) % max_duration

    if (current_frame < total_frames) setTimeout(capture_frame, frame_duration)
  }

  capture_frame()
  return Promise.resolve()
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
 * Renders an SVG animation to a video blob at 24fps for download using parallel workers
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

  const { ctx, output, canvas_source } = setup_canvas_and_encoder(
    canvas_width,
    canvas_height,
    fps,
    total_frames,
    writable_stream
  )

  await output.start()

  for (let current_frame = 0; current_frame < total_frames; current_frame++) {
    const current_time = current_frame / FRAMES_PER_SECOND

    // eslint-disable-next-line no-await-in-loop
    await capture_svg_frame(
      svg_element,
      ctx,
      canvas_width,
      canvas_height,
      current_time
    )

    const timestamp = current_frame / fps
    const frame_duration = 1 / fps

    try {
      // eslint-disable-next-line no-await-in-loop
      await canvas_source.add(timestamp, frame_duration)
    } catch (error) {
      console.error(`[Video] Error adding frame ${current_frame}:`, error)
      canvas_source.close()
      throw error
    }

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
