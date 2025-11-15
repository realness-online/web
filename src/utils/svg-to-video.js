/** @typedef {import('@/types').Id} Id */

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
  let mime_type = mime_types.find(type =>
    MediaRecorder.isTypeSupported(type)
  )
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

    if (current_frame < total_frames) {
      setTimeout(capture_frame, frame_duration)
    } else {
      media_recorder.stop()
    }
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

    if (current_frame < total_frames) {
      setTimeout(capture_frame, frame_duration)
    }
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
 * Renders an SVG animation to a video blob at 24fps for download
 * @param {SVGSVGElement} svg_element - The SVG element with animations
 * @param {Object} options - Configuration options
 * @param {number} [options.fps=24] - Target frames per second
 * @param {number} [options.max_duration=172] - Maximum animation duration in seconds
 * @param {number} [options.width] - Canvas width (defaults to SVG viewBox width)
 * @param {number} [options.height] - Canvas height (defaults to SVG viewBox height)
 * @param {Function} [options.on_progress] - Progress callback (frame, total_frames)
 * @returns {Promise<Blob>} Video blob ready for download
 */
export const render_svg_to_video_blob = async (
  svg_element,
  { fps = 24, max_duration = 172, width, height, on_progress } = {}
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
  let mime_type = mime_types.find(type =>
    MediaRecorder.isTypeSupported(type)
  )
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

    if (on_progress) on_progress(current_frame + 1, total_frames)

    current_frame++
    current_time = (current_frame / fps) % max_duration

    if (current_frame < total_frames) {
      setTimeout(capture_frame, frame_duration)
    } else {
      media_recorder.stop()
    }
  }

  capture_frame()

  return recording_promise
}

