import { get, set, del } from 'idb-keyval'
import { render_complete_poster_to_canvas } from '@/utils/render-poster-to-canvas'

export const homescreen_poster_icon_idb_key = 'homescreen_poster_icon'

/** PWA / apple-touch-icon export size (matches manifest 512 slot). */
const HOMESCREEN_POSTER_ICON_PX = 512

const homescreen_fill = '#151518'

/** @type {string | null} */
let poster_icon_object_url = null

/** @type {string | null} */
let manifest_source_url = null

/** @type {string | null} */
let manifest_blob_url = null

export const homescreen_icon_version_query = () =>
  `v=${encodeURIComponent(String(import.meta.env.PACKAGE_VERSION || '0'))}`

const brand_apple_href = () => `/192.png?${homescreen_icon_version_query()}`
const brand_pwa_192 = () => `/192.png?${homescreen_icon_version_query()}`
const brand_pwa_512 = () => `/512.png?${homescreen_icon_version_query()}`

/**
 * @param {string} rel
 * @param {string} href
 */
const set_link_href = (rel, href) => {
  const link = document.querySelector(`link[rel="${rel}"]`)
  if (link) link.setAttribute('href', href)
}

const build_manifest_icons = (pwa192, pwa512) => [
  {
    src: pwa192,
    sizes: '192x192',
    type: 'image/png'
  },
  {
    src: pwa512,
    sizes: '512x512',
    type: 'image/png'
  },
  {
    src: pwa512,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable'
  }
]

/**
 * @param {string} pwa192
 * @param {string} pwa512
 */
const patch_manifest_icons = async (pwa192, pwa512) => {
  const link = /** @type {HTMLLinkElement | null} */ (
    document.querySelector('link[rel="manifest"]')
  )
  if (!link?.href) return

  if (!manifest_source_url) {
    const href = link.getAttribute('href') || link.href
    manifest_source_url = href.startsWith('blob:')
      ? new URL('/manifest.webmanifest', location.origin).href
      : new URL(href, location.href).href
  }

  try {
    const response = await fetch(manifest_source_url)
    const manifest = await response.json()
    manifest.icons = build_manifest_icons(pwa192, pwa512)
    if (manifest_blob_url) URL.revokeObjectURL(manifest_blob_url)
    manifest_blob_url = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], {
        type: 'application/manifest+json'
      })
    )
    link.setAttribute('href', manifest_blob_url)
  } catch {
    // Manifest patching is best-effort (offline, CSP edge cases).
  }
}

/**
 * @param {'brand' | 'poster'} variant
 */
export const apply_homescreen_icon = async variant => {
  let apple_href = brand_apple_href()
  let pwa192 = brand_pwa_192()
  let pwa512 = brand_pwa_512()

  if (variant === 'poster') {
    const blob = await get(homescreen_poster_icon_idb_key)
    if (blob) {
      if (poster_icon_object_url) URL.revokeObjectURL(poster_icon_object_url)
      poster_icon_object_url = URL.createObjectURL(blob)
      apple_href = poster_icon_object_url
      pwa192 = poster_icon_object_url
      pwa512 = poster_icon_object_url
    }
  } else if (poster_icon_object_url) {
    URL.revokeObjectURL(poster_icon_object_url)
    poster_icon_object_url = null
  }

  set_link_href('apple-touch-icon', apple_href)
  await patch_manifest_icons(pwa192, pwa512)
}

/**
 * @param {SVGSVGElement} svg_element
 * @param {number} [size]
 * @returns {Promise<Blob>}
 */
export const render_poster_homescreen_square_png = async (
  svg_element,
  size = HOMESCREEN_POSTER_ICON_PX
) => {
  const vb = svg_element.viewBox.baseVal
  const aspect = vb.width / vb.height
  let rw
  let rh
  if (aspect >= 1) {
    rw = size
    rh = Math.round(size / aspect)
  } else {
    rh = size
    rw = Math.round(size * aspect)
  }

  const raster = await render_complete_poster_to_canvas(svg_element, rw, rh)
  const square = new OffscreenCanvas(size, size)
  const ctx = square.getContext('2d')
  if (!ctx) throw new Error('homescreen icon: 2d canvas context unavailable')
  ctx.fillStyle = homescreen_fill
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(raster, 0, 0, rw, rh, (size - rw) / 2, (size - rh) / 2, rw, rh)
  const blob = await square.convertToBlob({ type: 'image/png' })
  return blob
}

/**
 * @param {SVGSVGElement} svg_element
 */
export const save_poster_as_homescreen_icon = async svg_element => {
  const blob = await render_poster_homescreen_square_png(
    svg_element,
    HOMESCREEN_POSTER_ICON_PX
  )
  await set(homescreen_poster_icon_idb_key, blob)
}

export const clear_saved_poster_homescreen_icon = async () => {
  await del(homescreen_poster_icon_idb_key)
  if (poster_icon_object_url) {
    URL.revokeObjectURL(poster_icon_object_url)
    poster_icon_object_url = null
  }
}
