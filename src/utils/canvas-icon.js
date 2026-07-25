import icon from '@/components/icon'
import { h, createApp as create_app } from 'vue'

const ICON_OPACITY = 0.7

/**
 * Stamp an icon from `public/icons.svg` onto a canvas. The icon component is
 * mounted offscreen so `<use href="#name">` resolves against the live document
 * before the SVG is serialized.
 *
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null} ctx
 * @param {string} icon_name
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @returns {Promise<void>}
 */
export const draw_icon_on_canvas = async (ctx, icon_name, x, y, size) => {
  if (!ctx) return
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  document.body.appendChild(container)

  const app = create_app({
    render: () => h(icon, { name: icon_name })
  })
  app.mount(container)

  const icon_element = container.querySelector('svg.icon')
  if (!icon_element) {
    app.unmount()
    document.body.removeChild(container)
    return
  }

  icon_element.setAttribute('width', String(size))
  icon_element.setAttribute('height', String(size))

  const icon_svg_string = new XMLSerializer().serializeToString(icon_element)
  const icon_blob = new Blob([icon_svg_string], { type: 'image/svg+xml' })
  const icon_url = URL.createObjectURL(icon_blob)

  const icon_img = new Image()
  await new Promise((resolve, reject) => {
    icon_img.onload = resolve
    icon_img.onerror = reject
    icon_img.src = icon_url
  })

  ctx.save()
  ctx.globalAlpha = ICON_OPACITY
  ctx.drawImage(icon_img, x, y, size, size)
  ctx.restore()

  URL.revokeObjectURL(icon_url)
  app.unmount()
  document.body.removeChild(container)
}
