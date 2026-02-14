<script setup>
  import AsSvg from '@/components/posters/as-svg'
  import AsPosterSymbol from '@/components/posters/as-poster-symbol'
  import AsLink from '@/components/profile/as-link'
  import AsDownload from '@/components/download-vector'
  import AsMessenger from '@/components/profile/as-messenger'
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/types').Poster} Poster */
  import {
    as_query_id,
    as_author,
    load_from_cache,
    load,
    as_layer_id,
    as_created_at
  } from '@/utils/itemid'
  import { get_item } from '@/utils/item'
  import { get } from 'idb-keyval'
  import {
    is_vector,
    is_vector_id,
    is_click,
    geology_layers
  } from '@/use/poster'
  import { cutout } from '@/utils/preference'
  import { as_time } from '@/utils/date'
  import { current_user } from '@/utils/serverless'
  import {
    ref,
    computed,
    watchEffect as watch_effect,
    watch,
    onUpdated as updated,
    nextTick as tick,
    provide
  } from 'vue'
  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validate: is_vector_id
    },
    menu: {
      type: Boolean,
      default: false
    },
    slice: {
      type: Boolean,
      default: undefined
    }
  })
  const emit = defineEmits({
    'vector-click': is_click,
    show: is_vector
  })
  const poster = ref(null)
  const vector = ref(null)
  const person = ref(null)
  const menu_open = ref(false)
  const posted_at = computed(() =>
    as_time(new Date(as_created_at(/** @type {Id} */ (props.itemid))))
  )

  const vector_click = () => {
    if (!props.menu) return
    menu_open.value = !menu_open.value
  }
  const symbol_loaded = ref({
    boulders: false,
    rocks: false,
    gravel: false,
    sand: false,
    sediment: false
  })

  const query_id = computed(() => as_query_id(/** @type {Id} */ (props.itemid)))
  const shown = ref(false)
  const working = ref(true)

  const on_show = async shown_vector => {
    if (!shown_vector) return

    working.value = true
    vector.value = shown_vector

    if (!shown_vector.regular) {
      const shadow_id = as_layer_id(/** @type {Id} */ (props.itemid), 'shadows')
      let html_string = await get(shadow_id)
      let pattern = null
      if (!html_string) {
        const { item, html } = await load_from_cache(shadow_id)
        if (html) html_string = html
        if (item) pattern = item
      }
      if (!pattern && html_string) pattern = get_item(html_string, shadow_id)

      if (pattern) {
        const pattern_data = /** @type {Poster} */ (
          /** @type {unknown} */ (pattern)
        )
        vector.value.light = pattern_data.light
        vector.value.regular = pattern_data.regular
        vector.value.medium = pattern_data.medium
        vector.value.bold = pattern_data.bold
        vector.value.background = pattern_data.background
      }
    }

    if (vector.value && vector.value.regular) {
      await tick()
      emit('show', vector.value)
      shown.value = true
      working.value = false
    }

    if (!vector.value.cutouts) {
      vector.value.cutouts = {}
      const cutout_promises = geology_layers.map(async layer => {
        const layer_id = as_layer_id(/** @type {Id} */ (props.itemid), layer)
        const html_string = await get(layer_id)
        if (html_string) {
          vector.value.cutouts[layer] = true
          return
        }
        const { html } = await load_from_cache(layer_id)
        if (html) vector.value.cutouts[layer] = true
      })
      Promise.all(cutout_promises)
    }
  }

  provide('vector', vector)
  watch_effect(async () => {
    const should_load_person = props.menu || menu_open.value
    if (should_load_person && !person.value) {
      const author_id = as_author(/** @type {Id} */ (props.itemid))
      // False positive: sequential assignment after async load
      // eslint-disable-next-line require-atomic-updates
      if (author_id) person.value = await load(/** @type {Id} */ (author_id))
    }
  })
  watch(
    () => props.menu,
    menu_enabled => {
      if (!menu_enabled) menu_open.value = false
    }
  )
  watch(cutout, new_value => {
    if (!new_value)
      symbol_loaded.value = {
        boulders: false,
        rocks: false,
        gravel: false,
        sand: false,
        sediment: false
      }
  })

  updated(() => {
    const fragment = window.location.hash.substring(1)
    if (query_id.value === fragment && poster.value) {
      poster.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.location.hash = ''
    }
  })
</script>

<template>
  <figure ref="poster" class="poster">
    <as-svg
      :itemid="itemid"
      :slice="slice"
      @show="on_show"
      @click="vector_click"
      :focusable="false" />
    <as-poster-symbol
      v-if="shown"
      :itemid="itemid"
      :vector="vector"
      :shown="shown" />
    <figcaption v-if="menu_open">
      <slot>
        <menu>
          <as-link v-if="current_user" :itemid="/** @type {Id} */ (itemid)">
            <time>{{ posted_at }}</time>
          </as-link>
          <span class="actions">
            <as-messenger
              v-if="current_user"
              :itemid="/** @type {Id} */ (itemid)" />
            <as-download :itemid="/** @type {Id} */ (itemid)" />
          </span>
        </menu>
      </slot>
    </figcaption>
  </figure>
</template>

<style lang="stylus">
  figure.poster {
    position: relative;
    min-height: 512px;
    border-radius: round((base-line * .03), 2);
    grid-row-start: span 2;
    scroll-margin: 50vh;
    scroll-snap-align: center;
    &:has(svg[style*='aspect-ratio']) {
      grid-column-start: span 3;
      grid-row-start: auto;
    }
    &:focus {
      outline: 0.25px solid red;
      outline-offset: base-line * 0.25;
    }
    @media (orientation: landscape), (min-width: page-width) {
      &:has(svg.landscape) {
        grid-column-start: span 2;
        grid-row-start: auto;
        width: 100%;
        min-height: auto;
        &.new {
          grid-column-start: span 2;
        }
        &:has(svg[style*='aspect-ratio']) {
          grid-column-start: span 3;
        }
      }
    }
    @media (min-width: pad-begins) {
      &:has(svg.landscape) + &:has(svg.landscape) {
        grid-column-start: span 3;
      }
    }
    @media (min-width: pad-begins){
      &.new:not(:has(svg.landscape)) {
        grid-column: 2;
        grid-row: 2;
      }
    }
    svg {
      z-index: 1;
      &[itemscope] {
        position: relative;
      }
    }
    & > figcaption {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      transform: none;
      z-index: 3;
      pointer-events: none;

      menu {
        pointer-events: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: base-line;
        & > a,
        & > nav,
        & > button,
        & > fieldset,
        & > span.actions {
          pointer-events: auto;
        }
        & > span.actions {
          display: flex;
          gap: base-line;
          align-items: center;
        }
        & > a.profile {
          z-index: 2;
          position: relative;
          animation-name: fade-in;
          animation-duration: 0.1s;
          padding: base-line * .33;
          background: black-transparent;
          border-radius: base-line * .25;
          standard-shadow: boop;
          & > address {
            & > h3:first-of-type {
              margin-right: base-line * .333;
            }
            & > h3,
            & > time {
              color: blue;
              line-height: 1;
            }
          }
        }
        & > span.actions > nav,
        & > span.actions > a {
          standard-shadow: boop;
        }
        & > a.profile > svg,
        & > span.actions svg {
          fill: green;
        }
      }
    }
  }
</style>
