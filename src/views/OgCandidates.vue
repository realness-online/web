<script setup>
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/types').Item} Item */

  import AsFigure from '@/components/posters/as-figure'
  import { use_posters } from '@/use/poster'
  import { load, as_query_id } from '@/utils/itemid'
  import { find_geology_symbol, load_cutout_flags } from '@/utils/geology'
  import { wait_for_poster_export_ready } from '@/utils/export-poster'
  import { render_complete_poster_to_canvas } from '@/utils/poster-canvas'
  import { draw_icon_on_canvas } from '@/utils/canvas-icon'
  import { mosaic } from '@/utils/preference'
  import {
    OG_WIDTH,
    OG_HEIGHT,
    candidate_filename,
    draw_og_card,
    ensure_og_fonts,
    landscape_posters,
    og_mark_placement,
    resolve_css_color
  } from '@/utils/og-candidates'
  import {
    og_image_cta,
    og_image_headline,
    og_image_subhead
  } from '@/prerender/pages'
  import { ref, onMounted as mounted, nextTick as tick } from 'vue'

  const JPEG_QUALITY = 0.9
  const POLL_MS = 100
  const POSTER_TIMEOUT_MS = 30000

  /** @type {import('vue').Ref<Item[]>} */
  const sources = ref([])
  /** Only one poster is mounted at a time - it has the staging frame to itself. */
  /** @type {import('vue').Ref<Item | null>} */
  const current = ref(null)
  /** @type {import('vue').Ref<{ itemid: Id, style: string, file: string, data_url: string }[]>} */
  const candidates = ref([])
  const status = ref('Loading posters')

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
    const deadline = Date.now() + POSTER_TIMEOUT_MS
    while (Date.now() < deadline) {
      const value = check()
      if (value) return value
      await sleep(POLL_MS)
    }
    return null
  }

  /**
   * A poster is a shell until its layer files arrive as symbols in the figure's
   * companion defs. Rasterizing before then yields an empty frame.
   * @param {Id} itemid
   * @returns {Promise<SVGSVGElement | null>}
   */
  const wait_for_poster = async itemid => {
    const svg = await wait_for(() => {
      const el = document.getElementById(as_query_id(itemid))
      return el instanceof SVGSVGElement ? el : null
    })
    if (!svg) return null

    const defs = await wait_for(() =>
      svg.closest('figure')?.querySelector('svg[data-poster-symbol-defs]')
    )
    if (!defs) return svg

    const cutouts = await load_cutout_flags(itemid)
    const layers = Object.keys(cutouts).filter(layer => cutouts[layer])
    await wait_for(() =>
      layers.every(layer =>
        find_geology_symbol(defs, itemid, layer)?.querySelector('path')
      )
    )
    await wait_for_poster_export_ready(svg, itemid)
    return svg
  }

  /**
   * @param {OffscreenCanvas} canvas
   * @returns {Promise<string>}
   */
  const as_data_url = async canvas => {
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: JPEG_QUALITY
    })
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(blob)
    })
  }

  /**
   * @param {SVGSVGElement} svg
   * @returns {Promise<OffscreenCanvas>}
   */
  const og_frame = svg =>
    render_complete_poster_to_canvas(svg, OG_WIDTH, OG_HEIGHT, {
      fit: 'slice'
    })

  /**
   * @param {Id} itemid
   * @param {SVGSVGElement} svg
   */
  const bleed_candidate = async (itemid, svg) => {
    const canvas = await og_frame(svg)
    const { size, x, y } = og_mark_placement()
    await draw_icon_on_canvas(canvas.getContext('2d'), 'realness', x, y, size)
    return {
      itemid,
      style: 'bleed',
      file: candidate_filename(itemid, 'bleed'),
      data_url: await as_data_url(canvas)
    }
  }

  /**
   * @param {Id} itemid
   * @param {SVGSVGElement} svg
   */
  const card_candidate = async (itemid, svg) => {
    const canvas = await og_frame(svg)
    const ctx = canvas.getContext('2d')
    if (ctx)
      draw_og_card(ctx, {
        headline: og_image_headline,
        subhead: og_image_subhead,
        cta: og_image_cta,
        accent: resolve_css_color('--accent'),
        contrast: resolve_css_color('--contrast')
      })
    return {
      itemid,
      style: 'card',
      file: candidate_filename(itemid, 'card'),
      data_url: await as_data_url(canvas)
    }
  }

  const build_candidates = async () => {
    for (const [index, item] of sources.value.entries()) {
      const itemid = /** @type {Id} */ (item.id)
      status.value = `Rendering ${index + 1} of ${sources.value.length}`
      current.value = item
      await tick()

      const svg = await wait_for_poster(itemid)
      if (svg) {
        candidates.value.push(await bleed_candidate(itemid, svg))
        candidates.value.push(await card_candidate(itemid, svg))
      } else console.warn(`[og] ${itemid} never finished loading`)

      current.value = null
      await tick()
    }
  }

  const { posters, for_person } = use_posters()

  mounted(async () => {
    const admin_id = import.meta.env.VITE_ADMIN_ID
    if (!admin_id) {
      status.value = 'VITE_ADMIN_ID is not set'
      window.__og_candidates_done = true
      return
    }

    await for_person({ id: admin_id })
    const items = await Promise.all(
      posters.value.map(poster => load(/** @type {Id} */ (poster.id)))
    )
    sources.value = landscape_posters(items.filter(Boolean))

    await ensure_og_fonts()
    await build_candidates()

    window.__og_candidates = candidates.value
    window.__og_candidates_done = true
    status.value = `${candidates.value.length} candidates`
  })
</script>

<template>
  <article id="og-candidates">
    <header>
      <h1>Open Graph candidates</h1>
      <p>{{ status }}</p>
      <p v-if="!mosaic">
        Mosaic is off, so posters render without their cutout layers.
      </p>
    </header>
    <ol>
      <li v-for="candidate in candidates" :key="candidate.file">
        <a :href="candidate.data_url" :download="candidate.file">
          <img
            :src="candidate.data_url"
            :alt="candidate.file"
            :width="OG_WIDTH"
            :height="OG_HEIGHT" />
        </a>
        <p>{{ candidate.file }}</p>
      </li>
    </ol>
    <aside aria-hidden="true">
      <as-figure v-if="current" :key="current.id" :itemid="current.id" pin />
    </aside>
  </article>
</template>

<style lang="stylus">
  article#og-candidates
    padding: base-line
    & > ol
      display: grid
      gap: base-line
      list-style: none
      padding: 0
      & img
        width: 100%
        height: auto
    // The staging figure exists to be rasterized, not read. It needs real
    // layout for the poster to render, so it is moved out of view at the size
    // the candidates are cut to.
    & > aside
      position: fixed
      top: 0
      left: -200vw
      width: 1200px
      height: 630px
      & figure, & svg
        width: 100%
        height: 100%
</style>
