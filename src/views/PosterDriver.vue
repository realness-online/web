<script setup>
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/persistence/Queue').QueueItem} QueueItem */

  import { ref, provide, onMounted as mounted } from 'vue'
  import { del } from 'idb-keyval'
  import AsFigure from '@/components/posters/as-figure'
  import AsSvgProcessing from '@/components/posters/as-svg-processing'
  import { use as use_vectorize, resize_to_blob } from '@/use/vectorize'
  import { geology_layers } from '@/use/poster'
  import { completed_posters, current_processing } from '@/use/vectorize/queue'
  import { as_query_id, as_layer_id } from '@/utils/itemid'
  import { mutex_for } from '@/utils/algorithms'
  import {
    build_download_svg,
    wait_for_poster_export_ready
  } from '@/utils/export-poster'
  import { render_complete_poster_to_canvas } from '@/utils/poster-canvas'

  /**
   * PosterDriver is the seam for making posters from an arbitrary image (or
   * video frame) without the Thoughts feed UI. The app is the only renderer,
   * so this view drives it - the same machinery as the feed, end to end:
   *
   * 1. `render(data_url)` feeds the image to the real vectorize pipeline.
   * 2. `as-svg-processing` shows the live processing SVG while tracing - the
   *    optimizer captures that element's HTML.
   * 3. Done means done: the poster and all its layers are persisted to
   *    storage (`completed_posters` inclusion, pushed after `save_poster`).
   * 4. A fresh `as-figure` then loads the saved poster - the exact render
   *    path the feed uses. No pipeline state is read after completion.
   * 5. After the app's own export-ready gate, the finished poster is exported
   *    with the app's export utilities: standalone SVG, full figure HTML, and
   *    a PNG. The caller can parse the HTML with `get_item`/`get_itemprops`.
   */

  const DRIVER_AUTHOR = 'driver'
  const READY_TIMEOUT_MS = 120000
  const POLL_MS = 100
  const PNG_TARGET = 1200
  // Serialize driver renders on a driver-owned mutex (distinct from the
  // queue's 'vectorize' mutex, whose handler re-locks the same key and would
  // deadlock if we held it across the render). A frame's late-arriving worker
  // messages (vectorize/optimize completing) can never be clobbered by the
  // next frame's dispatch: the shared pipeline state is single-slot, so
  // overlapping renders race and drop traced paths.
  const render_mutex = mutex_for('poster-driver')

  const image_picker = ref(/** @type {HTMLInputElement | null} */ (null))
  const { vectorize, new_vector, mount_workers } = use_vectorize(image_picker)
  mount_workers()

  provide('new_vector', new_vector)

  /** @type {import('vue').Ref<QueueItem | null>} */
  const queue_item = ref(null)
  // The pipeline's own processing slot - the vectorized handler reads the
  // poster's width/height (and so its viewBox) from it, and
  // as-svg-processing keys off it. Same object the feed's queue uses.
  provide('current_processing', current_processing)

  /** @type {import('vue').Ref<Id | null>} */
  const persisted_itemid = ref(null)

  const status = ref('Idle')
  const ready = ref(false)

  const sleep = ms =>
    new Promise(resolve => {
      setTimeout(resolve, ms)
    })

  /**
   * @template T
   * @param {() => T} check
   * @returns {Promise<T | null>}
   */
  const wait_for = async check => {
    const deadline = Date.now() + READY_TIMEOUT_MS
    while (Date.now() < deadline) {
      const value = check()
      if (value) return value
      // oxlint-disable-next-line no-await-in-loop
      await sleep(POLL_MS)
    }
    return null
  }

  /**
   * Turn a data URL into a File this app can trace.
   * @param {string} data_url
   * @returns {File}
   */
  const data_url_to_file = data_url => {
    const [header, base64] = data_url.split(',')
    const mime = (header.match(/data:([^;]+)/) || [])[1] || 'image/png'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++)
      bytes[index] = binary.charCodeAt(index)
    return new File([bytes], `poster-${Date.now()}.png`, { type: mime })
  }

  /**
   * Rasterize the finished poster to a PNG data URL via the app's own export
   * canvas code.
   * @param {SVGSVGElement} svg
   * @param {number} width
   * @param {number} height
   * @returns {Promise<string>}
   */
  const as_png_data_url = async (svg, width, height) => {
    const canvas = await render_complete_poster_to_canvas(svg, width, height, {
      fit: 'meet'
    })
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(blob)
    })
  }

  /**
   * @param {string} data_url
   * @returns {Promise<{
   *   itemid: Id,
   *   svg: string,
   *   html: string,
   *   png: string,
   *   viewbox: string,
   *   width: number,
   *   height: number
   * }>}
   */
  const cleanup_storage = async itemid => {
    /** The poster itself, its shadow layer, and the geology cutout layers. */
    const keys = [
      itemid,
      as_layer_id(itemid, 'shadows'),
      ...geology_layers.map(layer => as_layer_id(itemid, layer))
    ]
    await Promise.all(keys.map(key => del(key)))
  }

  const render = async data_url => {
    await render_mutex.lock()
    try {
      return await render_inner(data_url)
    } finally {
      render_mutex.unlock()
    }
  }

  /** @param {string} data_url */
  const render_inner = async data_url => {
    const file = data_url_to_file(data_url)
    const created = Date.now()
    const itemid = /** @type {Id} */ (`/+${DRIVER_AUTHOR}/posters/${created}`)

    persisted_itemid.value = null

    // Pre-resize like the feed's queue does - the pipeline reads the poster
    // dimensions from `current_processing`.
    const {
      blob,
      width: poster_width,
      height: poster_height
    } = await resize_to_blob(file)
    queue_item.value = /** @type {QueueItem} */ ({
      id: itemid,
      itemid,
      status: 'processing',
      width: poster_width,
      height: poster_height
    })
    current_processing.value = queue_item.value

    status.value = 'Vectorizing'
    await vectorize(blob, itemid)

    // Done means done - the poster and every layer are saved to storage.
    const saved = await wait_for(() => completed_posters.value.includes(itemid))
    if (!saved) {
      status.value = 'poster never persisted'
      throw new Error('poster never persisted')
    }

    // Render the finished poster fresh from storage, the way the feed does.
    queue_item.value = null
    current_processing.value = null
    status.value = 'Rendering'
    persisted_itemid.value = itemid

    // Mounted and sized - as-figure starts on a 16x16 placeholder viewBox and
    // swaps in the real one once its poster loads from storage. A width over
    // zero accepts that placeholder, so wait for the dimensions we asked for.
    const svg = await wait_for(() => {
      const el = document.getElementById(as_query_id(itemid))
      if (!(el instanceof SVGSVGElement)) return null
      const { width, height } = el.viewBox.baseVal
      return width === poster_width && height === poster_height ? el : null
    })
    if (!svg) throw new Error('poster svg never mounted')

    // The companion symbol defs are v-if'd in, so an absent element means "not
    // mounted yet" - but wait_for_poster_export_ready reads absent as "nothing
    // to wait for" and returns at once. Capture then merges no symbols and the
    // frame exports with zero traced paths.
    const symbol_defs = await wait_for(() =>
      svg
        .closest('figure:has([itemtype="/posters"])')
        ?.querySelector('svg[data-poster-symbol-defs]')
    )
    if (!symbol_defs) throw new Error('poster symbol defs never mounted')

    await wait_for_poster_export_ready(svg, itemid)

    const download_svg = build_download_svg(svg)
    const width = download_svg.viewBox.baseVal.width || PNG_TARGET
    const height = download_svg.viewBox.baseVal.height || PNG_TARGET
    const png = await as_png_data_url(svg, width, height)
    const html = svg.closest('figure')?.outerHTML ?? download_svg.outerHTML
    // The poster was captured; drop it from storage so this batch stays flat.
    await cleanup_storage(itemid)
    status.value = 'Done'
    return {
      itemid,
      svg: download_svg.outerHTML,
      html,
      png,
      viewbox: download_svg.getAttribute('viewBox') || '',
      width,
      height
    }
  }

  mounted(() => {
    /** @type {any} */
    window.__poster_driver = {
      render,
      ready: true,
      get_status: () => status.value
    }
    ready.value = true
    status.value = `${DRIVER_AUTHOR} driver ready`
  })
</script>

<template>
  <article id="poster-driver" aria-busy="true">
    <header>
      <h1>Poster driver</h1>
      <p>{{ status }}</p>
      <p v-if="ready">Call window.__poster_driver.render(dataUrl).</p>
    </header>
    <aside aria-hidden="true">
      <as-svg-processing
        v-if="queue_item && !persisted_itemid"
        :queue_item="queue_item" />
      <as-figure
        v-if="persisted_itemid"
        :key="persisted_itemid"
        :itemid="persisted_itemid"
        pin />
    </aside>
    <input
      ref="image_picker"
      type="file"
      accept="image/*"
      multiple
      aria-hidden="true"
      class="visually-hidden" />
  </article>
</template>

<style lang="stylus">
  article#poster-driver > aside
    position: fixed
    top: 0
    left: -200vw
    width: 1200px
    height: 1200px
    & figure, & svg
      width: 100%
      height: 100%
</style>
