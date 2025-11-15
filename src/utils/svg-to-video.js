/** @typedef {import('@/types').Id} Id */
import { nextTick } from 'vue'
import {
  Output,
  MovOutputFormat,
  BufferTarget,
  StreamTarget,
  CanvasSource
} from 'mediabunny'

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
 * @param {string} animation_speed - Animation speed: 'fast', 'normal', 'slow', 'very_slow', 'glacial'
 * @returns {number} Duration in seconds
 */
const get_animation_duration = animation_speed => {
  const base_duration = 172
  const speed_multipliers = {
    fast: 0.5,
    normal: 1,
    slow: 2,
    very_slow: 4,
    glacial: 8
  }
  const multiplier = speed_multipliers[animation_speed] || 1
  return base_duration * multiplier
}

/**
 * Renders an SVG animation to a video element at 24fps
 * @param {SVGSVGElement} svg_element - The SVG element with animations
 * @param {Object} options - Configuration options
 * @param {number} [options.fps=24] - Target frames per second
 * @param {number} [options.max_duration=172] - Maximum animation duration in seconds
 * @param {number} [options.width] - Canvas width (defaults to SVG viewBox width)
 * @param {number} [options.height] - Canvas height (defaults to SVG viewBox height)
 * @returns {Promise<HTMLVideoElement>} Video element with the rendered animation
 */
export const render_svg_to_video = async (
  svg_element,
  { fps = 24, max_duration = 172, width, height } = {}
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

  const frame_duration = 1000 / fps
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

    await new Promise(resolve => requestAnimationFrame(resolve))

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
 * @param {number} [options.max_duration=172] - Maximum animation duration in seconds
 * @param {Function} [options.on_frame] - Callback called for each frame
 * @returns {Promise<void>}
 */
export const render_svg_to_canvas = async (
  svg_element,
  canvas,
  { fps = 24, max_duration = 172, on_frame } = {}
) => {
  if (!(svg_element instanceof SVGSVGElement))
    throw new Error('Element must be an SVGSVGElement')
  if (!(canvas instanceof HTMLCanvasElement))
    throw new Error('Canvas must be an HTMLCanvasElement')

  const ctx = canvas.getContext('2d')
  const frame_duration = 1000 / fps
  const total_frames = Math.ceil(max_duration * fps)

  let current_frame = 0
  let current_time = 0

  const capture_frame = async () => {
    svg_element.setCurrentTime(current_time)

    await new Promise(resolve => requestAnimationFrame(resolve))
    await new Promise(resolve => requestAnimationFrame(resolve))

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
    current_time = (current_frame / fps) % max_duration

    if (current_frame < total_frames) setTimeout(capture_frame, frame_duration)
  }

  capture_frame()
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
    fps = 24,
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

  let file_handle = null
  let writable_stream = null
  const use_file_system_api = 'showSaveFilePicker' in window

  if (use_file_system_api && suggested_filename) {
    console.info(
      '[Video] File System Access API detected - attempting direct file write'
    )
    try {
      file_handle = await /** @type {any} */ (window).showSaveFilePicker({
        suggestedName: suggested_filename,
        types: [
          {
            description: 'QuickTime Video',
            accept: { 'video/quicktime': ['.mov'] }
          }
        ]
      })
      writable_stream = await file_handle.createWritable()
      console.info(
        '[Video] Using File System Access API - writing directly to disk (memory efficient)'
      )
    } catch (error) {
      if (error.name === 'AbortError')
        console.info(
          '[Video] File System Access API cancelled by user - falling back to memory buffer'
        )
      else
        console.warn(
          '[Video] File System Access API error, using memory buffer:',
          error
        )
      file_handle = null
      writable_stream = null
    }
  } else if (!use_file_system_api)
    console.info(
      '[Video] File System Access API not supported - using memory buffer (Blob download)'
    )
  else if (!suggested_filename)
    console.info(
      '[Video] No suggested filename provided - using memory buffer (Blob download)'
    )

  const viewbox = svg_element.viewBox.baseVal
  let canvas_width = width || viewbox.width || svg_element.clientWidth
  let canvas_height = height || viewbox.height || svg_element.clientHeight

  canvas_width = canvas_width + (canvas_width % 2)
  canvas_height = canvas_height + (canvas_height % 2)

  const total_frames = Math.ceil(duration * fps)

  console.info('[Video] Starting video render', {
    duration,
    fps,
    total_frames,
    canvas_width,
    canvas_height,
    animation_speed
  })

  const render_start = performance.now()

  const canvas = document.createElement('canvas')
  canvas.width = canvas_width
  canvas.height = canvas_height
  const ctx = canvas.getContext('2d', { willReadFrequently: false })

  const target = writable_stream
    ? new StreamTarget(writable_stream, {
        chunked: true,
        chunkSize: 2 * 1024 * 1024
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

  await output.start()

  for (let current_frame = 0; current_frame < total_frames; current_frame++) {
    const current_time = current_frame / fps

    if (current_frame % 100 === 0)
      console.info(
        `[Video] Capturing frame ${current_frame}, time: ${current_time.toFixed(3)}s`
      )

    svg_element.setCurrentTime(current_time)

    await nextTick()
    await nextTick()

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

    const timestamp = current_frame / fps
    const frame_duration = 1 / fps

    try {
      await canvas_source.add(timestamp, frame_duration)
      if (current_frame % 100 === 0)
        console.info(`[Video] Frame ${current_frame} added successfully`)
    } catch (error) {
      console.error(`[Video] Error adding frame ${current_frame}:`, error)
      canvas_source.close()
      throw error
    }

    if (on_progress) on_progress(current_frame + 1, total_frames)

    if (current_frame % 50 === 0 || current_frame === total_frames - 1) {
      const progress = ((current_frame + 1) / total_frames) * 100
      console.info(
        `[Video] Frame ${current_frame + 1}/${total_frames} (${progress.toFixed(1)}%)`
      )
    }
  }

  console.info(`[Video] All frames captured: ${total_frames}/${total_frames}`)

  canvas_source.close()

  await output.finalize()

  const total_time = performance.now() - render_start

  if (writable_stream && file_handle) {
    console.info(
      `[Video] Video saved directly to file via File System Access API in ${total_time.toFixed(0)}ms (memory efficient)`
    )
    return null
  }

  const buffer_target = /** @type {BufferTarget} */ (output.target)
  if (!buffer_target.buffer) throw new Error('Output buffer is null')
  const blob = new Blob([buffer_target.buffer], { type: 'video/quicktime' })

  const bytes_per_mb = 1024 * 1024
  console.info(
    `[Video] Video render complete: ${(blob.size / bytes_per_mb).toFixed(2)}MB blob created in ${total_time.toFixed(0)}ms (using memory buffer)`
  )

  return blob
}
