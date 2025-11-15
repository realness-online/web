/** @typedef {import('@/types').Id} Id */

/**
 * Calculates animation duration based on animation speed preference
 * @param {string} animation_speed - Animation speed: 'fast', 'normal', 'slow', 'very_slow', 'glacial'
 * @returns {number} Duration in seconds
 */
const get_animation_duration = animation_speed => {
  const base_duration = 172 // Longest animation cycle in seconds
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

  // Try to find supported mime type
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

    // Wait for SVG to update after setCurrentTime
    await new Promise(resolve => requestAnimationFrame(resolve))
    await new Promise(resolve => requestAnimationFrame(resolve))

    // Serialize SVG at current animation state
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

    // Wait for SVG to update after setCurrentTime
    await new Promise(resolve => requestAnimationFrame(resolve))
    await new Promise(resolve => requestAnimationFrame(resolve))

    // Serialize SVG at current animation state
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
export const download_video = (blob, filename = 'animation.webm') => {
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
 * @returns {Promise<Blob>} Video blob ready for download
 */
export const render_svg_to_video_blob = async (
  svg_element,
  {
    fps = 24,
    max_duration,
    animation_speed = 'normal',
    width,
    height,
    on_progress
  } = {}
) => {
  if (!(svg_element instanceof SVGSVGElement))
    throw new Error('Element must be an SVGSVGElement')

  // Ensure animations are enabled
  svg_element.unpauseAnimations()

  // Calculate duration from animation_speed if not provided
  const duration = max_duration || get_animation_duration(animation_speed)

  const viewbox = svg_element.viewBox.baseVal
  const canvas_width = width || viewbox.width || svg_element.clientWidth
  const canvas_height = height || viewbox.height || svg_element.clientHeight

  const total_frames = Math.ceil(duration * fps)

  console.log('[Video] Starting video render', {
    duration,
    fps,
    total_frames,
    canvas_width,
    canvas_height,
    animation_speed
  })

  // Create worker pool based on available cores
  const available_cores = navigator.hardwareConcurrency || 4
  const worker_count = Math.min(available_cores, total_frames)
  const frames_per_worker = Math.ceil(total_frames / worker_count)

  console.log('[Video] Worker pool configuration', {
    available_cores,
    worker_count,
    frames_per_worker,
    total_frames
  })

  // Serialize base SVG once for workers to use
  const base_svg_string = new XMLSerializer().serializeToString(svg_element)

  const render_start = performance.now()

  // Create canvas and MediaRecorder
  const canvas = document.createElement('canvas')
  canvas.width = canvas_width
  canvas.height = canvas_height
  const ctx = canvas.getContext('2d')

  const stream = canvas.captureStream(fps)

  // Try to find supported mime type
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

  const recording_promise = new Promise((resolve, reject) => {
    media_recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      resolve(blob)
    }
    media_recorder.onerror = reject
  })

  media_recorder.start()
  console.log('[Video] MediaRecorder started with mime type:', mime_type)

  // Create workers and distribute frame SVG strings
  const workers = []
  const frame_promises = []

  console.log('[Video] Initializing workers...')
  console.log('[Video] About to create', worker_count, 'workers')
  const worker_init_start = performance.now()

  for (let i = 0; i < worker_count; i++) {
    console.log(`[Video] Creating worker ${i + 1} of ${worker_count}...`)
    const start_frame = i * frames_per_worker
    const end_frame = Math.min(start_frame + frames_per_worker, total_frames)

    if (start_frame >= total_frames) break

    let worker
    try {
      console.log(
        `[Video] Attempting to create worker ${i + 1} with path: /video-frame.worker.js`
      )
      worker = new Worker('/video-frame.worker.js')
      console.log(
        `[Video] ✓ Worker ${i + 1}/${worker_count} created successfully (frames ${start_frame}-${end_frame - 1})`
      )

      // Verify worker is ready
      worker.addEventListener('error', e => {
        console.error(`[Video] Worker ${i + 1} load error:`, e)
      })
    } catch (error) {
      console.error(`[Video] ✗ Failed to create worker ${i + 1}:`, error)
      console.error(`[Video] Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
      throw error
    }

    const worker_promise = new Promise((resolve, reject) => {
      const worker_start = performance.now()

      worker.onmessage = event => {
        const worker_time = performance.now() - worker_start
        const frame_count = event.data.frames?.length || 0
        console.log(
          `[Video] Worker ${i + 1} completed: ${frame_count} frames in ${worker_time.toFixed(0)}ms`
        )
        resolve(event.data.frames)
        worker.terminate()
      }

      worker.onerror = error => {
        console.error(`[Video] Worker ${i + 1} error:`, error)
        console.error(`[Video] Worker ${i + 1} error details:`, {
          message: error.message,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno
        })
        reject(error)
      }

      worker.onmessageerror = error => {
        console.error(`[Video] Worker ${i + 1} message error:`, error)
        reject(error)
      }
    })

    console.log(
      `[Video] Sending frames ${start_frame}-${end_frame - 1} to worker ${i + 1}`
    )

    worker.postMessage({
      route: 'prepare_and_render:frames',
      svg_string: base_svg_string,
      start_frame,
      end_frame,
      fps,
      duration,
      canvas_width,
      canvas_height
    })

    console.log(
      `[Video] Message sent to worker ${i + 1}, waiting for response...`
    )

    workers.push(worker)
    frame_promises.push(worker_promise)
  }

  const worker_init_time = performance.now() - worker_init_start
  console.log(
    `[Video] All ${worker_count} workers initialized in ${worker_init_time.toFixed(0)}ms`
  )

  // Wait for all workers to complete
  console.log('[Video] Waiting for workers to complete rendering...')
  const all_frames = await Promise.all(frame_promises)
  const render_time = performance.now() - render_start
  console.log(
    `[Video] All workers completed: ${all_frames.flat().length} frames rendered in ${render_time.toFixed(0)}ms`
  )

  // Flatten and sort frames by index
  const sorted_frames = all_frames
    .flat()
    .sort((a, b) => a.frame_index - b.frame_index)

  // Feed frames to MediaRecorder in order
  console.log('[Video] Feeding frames to MediaRecorder...')
  const encoding_start = performance.now()
  let frames_encoded = 0

  for (const frame_data of sorted_frames) {
    ctx.clearRect(0, 0, canvas_width, canvas_height)
    ctx.drawImage(frame_data.image_bitmap, 0, 0)

    // Close ImageBitmap to free memory
    frame_data.image_bitmap.close()

    frames_encoded++
    if (frames_encoded % 50 === 0 || frames_encoded === sorted_frames.length) {
      const encoding_progress = (frames_encoded / sorted_frames.length) * 100
      console.log(
        `[Video] Encoding: ${frames_encoded}/${sorted_frames.length} frames (${encoding_progress.toFixed(1)}%)`
      )
    }

    if (on_progress) {
      const prep_progress = total_frames
      const render_progress = frame_data.frame_index + 1
      on_progress(prep_progress + render_progress, total_frames * 2)
    }

    // Small delay to allow MediaRecorder to capture
    await new Promise(resolve => requestAnimationFrame(resolve))
  }

  const encoding_time = performance.now() - encoding_start
  console.log(
    `[Video] Encoding complete: ${frames_encoded} frames in ${encoding_time.toFixed(0)}ms`
  )

  media_recorder.stop()
  console.log('[Video] MediaRecorder stopped, waiting for final blob...')

  const blob = await recording_promise
  const total_time = performance.now() - render_start
  console.log(
    `[Video] Video render complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB in ${total_time.toFixed(0)}ms`
  )

  return blob
}
