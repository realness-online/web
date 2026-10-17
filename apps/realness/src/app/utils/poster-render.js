/** @fileoverview Mount one poster off-screen and hand back its `<svg>` once the
 * figure has drawn it. The caller supplies the figure component, so this module
 * owns the mount and nothing about which component renders a poster. */
import { createApp as create_app, h, nextTick as tick } from 'vue'
import { as_query_id } from '@/utils/itemid'

const SVG_WAIT_TIMEOUT_MS = 30000

/**
 * @typedef {{
 *   cancelled: boolean
 *   on_cancel: Set<() => void>
 * }} Render_Run
 */

/**
 * @typedef {{
 *   svg: SVGSVGElement
 *   unmount: () => void
 * }} Mounted_Poster
 */

/**
 * A container too far off-screen to paint, sized like a poster so layout work
 * completes.
 * @returns {HTMLElement}
 */
export const poster_container = () => {
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:24rem;height:36rem;overflow:hidden;visibility:hidden'
  document.body.appendChild(container)
  return container
}

/**
 * Resolve with the poster's `<svg>` once it emits `show` - event-driven, no
 * polling, so it settles or times out even in a backgrounded tab. Rejects on
 * `missing`, on `run` cancel, or after a timeout.
 * @param {import('@/types').Id} itemid
 * @param {import('vue').Component} figure
 * @param {HTMLElement} container
 * @param {Render_Run} run
 * @returns {Promise<Mounted_Poster>}
 */
export const mount_poster = async (itemid, figure, container, run) => {
  /** @type {(value: SVGSVGElement) => void} */
  let resolve
  /** @type {(error: Error) => void} */
  let reject
  const drawn = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  let settled = false
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  const cancelled = () => {
    const error = new Error('folder-sync-cancelled')
    error.name = 'FolderSyncCancelled'
    return error
  }

  /**
   * @param {Error | null} error
   * @param {SVGSVGElement} [svg]
   */
  const finish = (error, svg) => {
    if (settled) return
    settled = true
    if (timer) clearTimeout(timer)
    run.on_cancel.delete(on_cancel)
    if (error) reject(error)
    else resolve(/** @type {SVGSVGElement} */ (svg))
  }
  const on_cancel = () => finish(cancelled())
  run.on_cancel.add(on_cancel)
  timer = setTimeout(
    () => finish(new Error(`Timeout waiting for poster: ${itemid}`)),
    SVG_WAIT_TIMEOUT_MS
  )

  const app = create_app({
    name: 'PosterRender',
    render: () =>
      h(figure, {
        itemid,
        menu: false,
        /** Off-screen mount never intersects the viewport; pin forces cutout symbols to load. */
        pin: true,
        onShow: async () => {
          await tick()
          const svg = document.getElementById(as_query_id(itemid))
          if (svg instanceof SVGSVGElement) finish(null, svg)
          else finish(new Error(`Poster SVG missing after show: ${itemid}`))
        },
        onMissing: () => finish(new Error(`Poster reported missing: ${itemid}`))
      })
  })
  app.provide('set_working', () => {})
  app.component('router-link', (_props, { slots }) => h('a', slots.default?.()))
  app.mount(container)

  return { svg: await drawn, unmount: () => app.unmount() }
}
