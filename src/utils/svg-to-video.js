import {
  Output,
  MovOutputFormat,
  BufferTarget,
  StreamTarget,
  CanvasSource,
  AudioBufferSource
} from 'mediabunny'
import {
  BASE_DURATION,
  ANIMATION_SPEED_MULTIPLIERS
} from '@/utils/animation-config'

// Video encoding constants
const DEFAULT_FPS = 24
// YouTube's recommended 4K H.264 upload range (35-45 Mbps); roughly
// 5x the 1080p baseline for the ~4x pixel jump, so gradients stay clean.
const VIDEO_BITRATE = 40000000
// Lossless: raw float32 PCM of the decoded AudioBuffer, no re-encode loss.
// MOV (QuickTime) carries PCM natively.
const AUDIO_CODEC = 'pcm-f32'
const BYTES_PER_KB = 1024
const CHUNK_SIZE_MB = 2

/**
 * Calculates animation duration based on animation speed preference
 * @param {string} animation_speed - See ANIMATION_SPEEDS in animation-config
 * @returns {number} Duration in seconds
 */
const get_animation_duration = animation_speed => {
  const multiplier = ANIMATION_SPEED_MULTIPLIERS[animation_speed] || 1
  return BASE_DURATION * multiplier
}

// Level 5.1 (36,864 macroblocks) is the ceiling browsers' H.264 encoders
// honor; a square poster at plain 3840-wide would blow past it (57,600 MBs),
// so scale to the largest size that keeps the ratio and stays in level:
// 16:9 tops out at true 4K (32,400 MBs), a square at 2160x2160.
const LEVEL51_TARGET = { width: 3840, height: 2160 }

/**
 * Largest Level-5.1-safe export size for a poster of the given viewbox
 * aspect, preserving the ratio and forcing even dimensions (H.264 needs
 * them). Scales the vector poster up to fill the level ceiling, never
 * cropping.
 * @param {{ width: number, height: number }} viewbox - Poster's intrinsic size
 * @returns {{ width: number, height: number }}
 */
export const level51_video_size = viewbox => {
  const scale = Math.min(
    LEVEL51_TARGET.width / viewbox.width,
    LEVEL51_TARGET.height / viewbox.height
  )
  const even = n => Math.max(2, Math.round(n) + (Math.round(n) % 2))
  return {
    width: even(viewbox.width * scale),
    height: even(viewbox.height * scale)
  }
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
 * @param {object} options
 * @param {any} [options.writable_stream] - Optional writable stream for File System API
 * @param {AudioBuffer[]} [options.audio_buffers] - Decoded audio to mux beside
 *   the video. When present the output also carries an AAC audio track.
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, output: any, canvas_source: any, audio_source: any}}
 */
const setup_canvas_and_encoder = (
  canvas_width,
  canvas_height,
  fps,
  total_frames,
  { writable_stream, audio_buffers } = {}
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

  let audio_source = null
  if (audio_buffers?.length) {
    audio_source = new AudioBufferSource({
      codec: AUDIO_CODEC
    })
    output.addAudioTrack(audio_source)
  }

  return { canvas, ctx, output, canvas_source, audio_source }
}

/**
 * SVG geometry attributes (SVGAnimatedLength). Their animated values read via
 * `el[prop].animVal.valueAsString` (units preserved). Everything else the
 * poster animates is a paint/presentation property read via computed style.
 */
const GEOMETRY_ATTRIBUTES = new Set([
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height'
])

/**
 * Reads the SMIL-animated value of an attribute from the live DOM. The
 * browser's SMIL engine computes the state (easing, keyTimes, repeats) after
 * setCurrentTime; this just copies its output, so the exported frame matches
 * what the poster shows natively without reimplementing any animation math.
 * @param {SVGElement} target - Live element the animation targets
 * @param {string} attribute_name - Animated attribute, e.g. 'fill-opacity'
 * @returns {string|null} Value safe to set as an attribute, or null
 */
const read_animated_value = (target, attribute_name) => {
  if (GEOMETRY_ATTRIBUTES.has(attribute_name)) {
    const anim = /** @type {any} */ (target)[attribute_name]?.animVal
    if (anim) return anim.valueAsString
  }
  return getComputedStyle(target).getPropertyValue(attribute_name) || null
}

/**
 * Resolves the id an animate element's href points at, with the same
 * shadows fallback the live poster uses (fragment ids reference the shadow
 * layer's paths by layer id, but the animate elements target the poster id).
 * @param {ParentNode} root - Document or svg to search
 * @param {string} target_id - id from the href, without '#'
 * @returns {SVGElement | null}
 */
const resolve_target = (root, target_id) => {
  let target = root.querySelector(`[id="${target_id}"]`)
  if (!target && target_id.includes('-')) {
    const parts = target_id.split('-')
    const last = parts.pop()
    const shadows_id = [...parts, 'shadows', last].join('-')
    target = root.querySelector(`[id="${shadows_id}"]`)
  }
  return /** @type {SVGElement | null} */ (target)
}

/**
 * Rasterizes the poster's SMIL state at one seeked time to an Image.
 * Clones the live SVG, bakes the browser-computed animated values onto the
 * clone (serialization cannot see the animated layer), removes the SMIL
 * elements, then loads the serialized frame as an image. The animation is
 * paused and seeked by the caller, so this is deterministic — a slow machine
 * just takes longer between frames.
 * @param {SVGSVGElement} svg_element - Live poster SVG (paused, seeked)
 * @param {number} canvas_width - Export width
 * @param {number} canvas_height - Export height
 * @returns {Promise<HTMLImageElement>}
 */
const rasterize_svg_frame = async (
  svg_element,
  canvas_width,
  canvas_height
) => {
  const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))
  svg_clone.setAttribute('width', String(canvas_width))
  svg_clone.setAttribute('height', String(canvas_height))

  // Symbols referenced by <use> and by the animate hrefs live in the hidden
  // defs svg; append them so the standalone serialized frame can resolve them.
  const figure = svg_element.closest('figure:has([itemtype="/posters"])')
  const hidden_svg = figure?.querySelector('svg[data-poster-symbol-defs]')
  hidden_svg?.querySelectorAll('symbol').forEach(symbol => {
    svg_clone.appendChild(symbol.cloneNode(true))
  })

  // as-animation renders its <animate> tree under the Vue component root;
  // flatten the wrapper so the serialized frame carries only the animates.
  svg_clone.querySelectorAll('as-animation').forEach(el => {
    el.replaceWith(...el.children)
  })

  // Bake the live SMIL state onto the clone, then strip the SMIL elements
  // from the clone only — the live poster keeps its animation for the next
  // frame's seek.
  const live_animates = svg_element.querySelectorAll('animate')
  live_animates.forEach(anim => {
    const attribute_name = anim.getAttribute('attributeName')
    const href = anim.getAttribute('href') || anim.getAttribute('xlink:href')
    if (!attribute_name || !href) return
    const target_id = href.replace(/^#/, '')
    const live_target = resolve_target(document, target_id)
    if (!live_target) return
    const value = read_animated_value(live_target, attribute_name)
    if (!value) return
    const clone_target = resolve_target(svg_clone, target_id)
    clone_target?.setAttribute(attribute_name, value)
  })
  svg_clone.querySelectorAll('animate').forEach(el => el.remove())

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
 * Renders the poster's animation to a video blob using the browser's own
 * SMIL engine: each frame seeks the SVG timeline with setCurrentTime and
 * rasterizes the seeked state. The browser computes easing, keyTimes, and
 * repeats natively (repeatCount="indefinite"), so audio longer than one
 * cycle keeps animating without any wrapping math — the export simply keeps
 * seeking past the cycle. A slow machine just exports slower; the video
 * itself is deterministic (every frame is stamped at encode time).
 * @param {SVGSVGElement} svg_element - The SVG element with animations
 * @param {Object} options - Configuration options
 * @param {number} [options.fps=24] - Target frames per second
 * @param {number} [options.max_duration] - Maximum animation duration in seconds (calculated from animation_speed if not provided)
 * @param {string} [options.animation_speed='normal'] - Animation speed preference
 * @param {number} [options.width] - Canvas width (defaults to SVG viewBox width)
 * @param {number} [options.height] - Canvas height (defaults to SVG viewBox height)
 * @param {Function} [options.on_progress] - Progress callback (frame, total_frames)
 * @param {string} [options.suggested_filename] - Suggested filename for File System Access API
 * @param {AudioBuffer[]} [options.audio_buffers] - One or more decoded
 *   audio buffers to mux as the soundtrack. When present the video runs for exactly the
 *   total audio length, with the animation looping natively to cover it.
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
    suggested_filename,
    audio_buffers
  } = {}
) => {
  if (!(svg_element instanceof SVGSVGElement))
    throw new Error('Element must be an SVGSVGElement')

  // Freeze the timeline; every frame seeks it explicitly, so the export is
  // deterministic regardless of how fast the machine renders.
  svg_element.pauseAnimations()

  const audio_duration = audio_buffers?.length
    ? audio_buffers.reduce((sum, buf) => sum + buf.duration, 0)
    : 0
  const duration =
    audio_duration || max_duration || get_animation_duration(animation_speed)
  const { file_handle, writable_stream } =
    await setup_file_system_api(suggested_filename)

  const viewbox = svg_element.viewBox.baseVal
  let canvas_width = width || viewbox.width || svg_element.clientWidth
  let canvas_height = height || viewbox.height || svg_element.clientHeight

  canvas_width = canvas_width + (canvas_width % 2)
  canvas_height = canvas_height + (canvas_height % 2)

  const total_frames = Math.floor(duration * fps) + 1

  const { ctx, output, canvas_source, audio_source } = setup_canvas_and_encoder(
    canvas_width,
    canvas_height,
    fps,
    total_frames,
    {
      writable_stream,
      audio_buffers
    }
  )

  await output.start()

  if (audio_source && audio_buffers?.length)
    // oxlint-disable-next-line no-await-in-loop
    for (const buffer of audio_buffers) await audio_source.add(buffer)

  // The poster's svg carries `content-visibility: auto`; if it is off-screen
  // the browser may skip rendering it, and the draw below would capture a
  // blank frame. Force it visible for the duration of the export.
  const previous_content_visibility = svg_element.style.contentVisibility
  svg_element.style.contentVisibility = 'visible'
  try {
    for (let frame = 0; frame < total_frames; frame++) {
      const timestamp = frame / fps
      // Seek natively: past one cycle the indefinite animations repeat on
      // their own, so long audio never hits a frozen final pose.
      svg_element.setCurrentTime(timestamp)

      // oxlint-disable-next-line no-await-in-loop
      const frame_image = await rasterize_svg_frame(
        svg_element,
        canvas_width,
        canvas_height
      )
      ctx.clearRect(0, 0, canvas_width, canvas_height)
      ctx.drawImage(frame_image, 0, 0, canvas_width, canvas_height)

      try {
        // oxlint-disable-next-line no-await-in-loop
        await canvas_source.add(timestamp, 1 / fps)
      } catch (error) {
        console.error(`[Video] Error adding frame ${frame}:`, error)
        canvas_source.close()
        throw error
      }
      if (on_progress) on_progress(frame + 1, total_frames)
    }
  } finally {
    svg_element.style.contentVisibility = previous_content_visibility
  }

  canvas_source.close()
  audio_source?.close()

  await output.finalize()

  if (writable_stream && file_handle) return null

  const buffer_target = /** @type {BufferTarget} */ (output.target)
  if (!buffer_target.buffer) throw new Error('Output buffer is null')
  const blob = new Blob([buffer_target.buffer], { type: 'video/quicktime' })

  return blob
}
