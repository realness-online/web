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
    prepare_poster_svg_for_3d,
    wait_for_poster_export_ready
  } from '@/utils/export-poster'
  import { render_complete_poster_to_canvas } from '@/utils/poster-canvas'
  import { render_svg_layers_to_psd } from '@/utils/svg-to-psd'
  import { with_poster_scene } from '@/3d/scenes/with-poster-scene.js'

  const DRIVER_AUTHOR = 'driver'

  const DEFAULT_FORMATS = ['png']
  const BASE64_CHUNK = 0x8000
  const READY_TIMEOUT_MS = 120000
  const DRAWABLE_TIMEOUT_MS = 10000
  const BLANK_POSTER = 'poster has no drawable layer'
  const POLL_MS = 100
  const PNG_TARGET = 1200
  const render_mutex = mutex_for('poster-driver')

  const image_picker = ref(/** @type {HTMLInputElement | null} */ (null))
  const { vectorize, new_vector, mount_workers } = use_vectorize(image_picker)
  mount_workers()

  provide('new_vector', new_vector)

  /** @type {import('vue').Ref<QueueItem | null>} */
  const queue_item = ref(null)
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
   * @param {number} [timeout_ms]
   * @returns {Promise<T | null>}
   */
  const wait_for = async (check, timeout_ms = READY_TIMEOUT_MS) => {
    const deadline = Date.now() + timeout_ms
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
   * @param {ArrayBuffer | Uint8Array} buffer
   * @returns {string}
   */
  const as_base64 = buffer => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    let binary = ''
    for (let index = 0; index < bytes.length; index += BASE64_CHUNK)
      binary += String.fromCharCode(
        ...bytes.subarray(index, index + BASE64_CHUNK)
      )
    return btoa(binary)
  }

  /**
   * The poster menu's GLB path without the download - mount a headless scene,
   * wait for its textures, hand back the binary glTF.
   * @param {SVGSVGElement} svg
   * @param {Id} itemid
   * @returns {Promise<string>}
   */
  const as_glb_base64 = async (svg, itemid) => {
    const svg_string = await prepare_poster_svg_for_3d(svg, itemid)
    let glb = ''
    await with_poster_scene(svg_string, async scene => {
      await scene.wait_for_textures()
      glb = as_base64(await scene.parse_glb())
    })
    return glb
  }

  /** @param {Id} itemid */
  const cleanup_storage = async itemid => {
    /** The poster itself, its shadow layer, and the geology cutout layers. */
    const keys = [
      itemid,
      as_layer_id(itemid, 'shadows'),
      ...geology_layers.map(layer => as_layer_id(itemid, layer))
    ]
    await Promise.all(keys.map(key => del(key)))
  }

  /**
   * @param {string} data_url
   * @param {{ formats?: string[] }} [options]
   * @returns {Promise<{
   *   itemid: Id,
   *   svg: string,
   *   html: string,
   *   png: string | null,
   *   psd: string | null,
   *   glb: string | null,
   *   viewbox: string,
   *   width: number,
   *   height: number
   * }>}
   */
  const render = async (data_url, options = {}) => {
    await render_mutex.lock()
    try {
      return await render_inner(
        data_url,
        new Set(options.formats ?? DEFAULT_FORMATS)
      )
    } finally {
      render_mutex.unlock()
    }
  }

  /**
   * @param {string} data_url
   * @param {Set<string>} formats
   */
  const render_inner = async (data_url, formats) => {
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

    const svg = await wait_for(() => {
      const el = document.getElementById(as_query_id(itemid))
      if (!(el instanceof SVGSVGElement)) return null
      const { width, height } = el.viewBox.baseVal
      return width === poster_width && height === poster_height ? el : null
    })
    if (!svg) throw new Error('poster svg never mounted')

    const symbol_defs = await wait_for(
      () =>
        svg
          .closest('figure:has([itemtype="/posters"])')
          ?.querySelector('svg[data-poster-symbol-defs]'),
      DRAWABLE_TIMEOUT_MS
    )
    if (!symbol_defs) throw new Error(BLANK_POSTER)

    await wait_for_poster_export_ready(svg, itemid)

    const download_svg = build_download_svg(svg)
    const width = download_svg.viewBox.baseVal.width || PNG_TARGET
    const height = download_svg.viewBox.baseVal.height || PNG_TARGET

    status.value = 'Exporting'
    const png = formats.has('png')
      ? await as_png_data_url(svg, width, height)
      : null
    const psd = formats.has('psd')
      ? as_base64(await render_svg_layers_to_psd(svg, itemid))
      : null
    const glb = formats.has('glb') ? await as_glb_base64(svg, itemid) : null
    const html = svg.closest('figure')?.outerHTML ?? download_svg.outerHTML

    // The poster was captured; drop it from storage so this batch stays flat.
    await cleanup_storage(itemid)
    status.value = 'Done'
    return {
      itemid,
      svg: download_svg.outerHTML,
      html,
      png,
      psd,
      glb,
      viewbox: download_svg.getAttribute('viewBox') || '',
      width,
      height
    }
  }

  mounted(() => {
    /** @type {any} */
    window.poster_driver = {
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
      <p v-if="ready">Call window.poster_driver.render(dataUrl).</p>
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
