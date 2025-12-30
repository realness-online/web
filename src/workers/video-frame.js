import { parseHTML } from 'linkedom'

const HALFWAY_POINT = 0.5

/**
 * Prepares and renders frames from base SVG using linkedom
 * @param {Object} message - Worker message
 * @param {Object} message.data - Message data
 * @param {string} message.data.svg_string - Base SVG string
 * @param {number} message.data.canvas_width - Canvas width
 * @param {number} message.data.canvas_height - Canvas height
 * @param {number} message.data.fps - Frames per second
 * @param {number} message.data.start_frame - Starting frame index
 * @param {number} message.data.end_frame - Ending frame index (exclusive)
 * @param {number} message.data.duration - Animation duration in seconds
 * @returns {Promise<Object>} Object with frames array of ImageBitmaps
 */
export const prepare_and_render_frames = async message => {
  const {
    svg_string,
    canvas_width,
    canvas_height,
    fps,
    start_frame,
    end_frame,
    duration
  } = message.data

  // Parse base SVG once - we'll modify it for each frame
  const { document: base_document } = parseHTML(svg_string)
  const base_svg_template = base_document.documentElement.outerHTML

  const frames = []

  for (let frame = start_frame; frame < end_frame; frame++) {
    const current_time = (frame / fps) % duration

    // Parse fresh copy of SVG for this frame (linkedom doesn't support cloning)
    const { document } = parseHTML(base_svg_template)
    const svg_element = document.documentElement

    // Set animation time by modifying animate elements
    const animate_elements = svg_element.querySelectorAll('animate')
    animate_elements.forEach(anim => {
      const dur_str = anim.getAttribute('dur') || '1s'
      const dur = parseFloat(dur_str.replace('s', ''))
      const values_str = anim.getAttribute('values')
      const attribute_name = anim.getAttribute('attributeName')
      const href = anim.getAttribute('href') || anim.getAttribute('xlink:href')

      if (!values_str || !attribute_name || !href) return

      const target_id = href.replace('#', '')
      const target = document.getElementById(target_id)
      if (!target) return

      const values = values_str.split(';').map(v => v.trim())
      if (values.length < 2) return

      const cycle_time = current_time % dur
      const progress = cycle_time / dur
      const value_index = Math.min(
        Math.floor(progress * (values.length - 1)),
        values.length - 2
      )
      const next_index = value_index + 1
      const local_progress = progress * (values.length - 1) - value_index

      const current_value = values[value_index]
      const next_value = values[next_index]

      if (current_value && next_value) {
        const current_num = parseFloat(current_value)
        const next_num = parseFloat(next_value)
        if (!isNaN(current_num) && !isNaN(next_num)) {
          const interpolated =
            current_num + (next_num - current_num) * local_progress
          target.setAttribute(attribute_name, interpolated.toString())
        } else
          target.setAttribute(
            attribute_name,
            local_progress < HALFWAY_POINT ? current_value : next_value
          )
      }
    })

    // Serialize animated SVG - ensure valid XML
    let animated_svg = svg_element.outerHTML

    // Ensure proper SVG namespace
    if (!animated_svg.includes('xmlns='))
      animated_svg = animated_svg.replace(
        '<svg',
        '<svg xmlns="http://www.w3.org/2000/svg"'
      )

    // Ensure viewBox or width/height for proper sizing
    if (!animated_svg.includes('viewBox') && !animated_svg.includes('width='))
      animated_svg = animated_svg.replace(
        '<svg',
        `<svg width="${canvas_width}" height="${canvas_height}"`
      )

    // Most efficient: Direct createImageBitmap with SVG blob
    const svg_blob = new Blob([animated_svg], {
      type: 'image/svg+xml;charset=utf-8'
    })

    let image_bitmap
    try {
      // Direct path: createImageBitmap with resize options (single operation)
      // eslint-disable-next-line no-await-in-loop
      image_bitmap = await createImageBitmap(svg_blob, {
        resizeWidth: canvas_width,
        resizeHeight: canvas_height,
        resizeQuality: 'high'
      })
    } catch {
      // Fallback: createImageBitmap without resize, then draw to canvas
      // eslint-disable-next-line no-await-in-loop
      const temp_bitmap = await createImageBitmap(svg_blob)
      const canvas = new OffscreenCanvas(canvas_width, canvas_height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(temp_bitmap, 0, 0, canvas_width, canvas_height)
      temp_bitmap.close()
      // eslint-disable-next-line no-await-in-loop
      image_bitmap = await createImageBitmap(canvas)
    }

    frames.push({
      frame_index: frame,
      image_bitmap
    })
  }

  return { frames }
}

export const route_message = async message => {
  const { route } = message.data
  let reply = {}

  switch (route) {
    case 'prepare_and_render:frames':
      reply = await prepare_and_render_frames(message)
      break
    default:
      console.warn('unknown route', route)
  }
  return reply
}

self.addEventListener('message', async event => {
  const reply = await route_message(event)

  self.postMessage(reply, {
    transfer: reply.frames?.map(f => f.image_bitmap) || []
  })
})
