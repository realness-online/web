<script setup>
  /* eslint-disable vue/no-static-inline-styles */
  import AsSvg from '@/components/posters/as-svg'
  import AsSymbol from '@/components/posters/as-symbol'
  import AsSymbolShadow from '@/components/posters/as-symbol-shadow'
  import Icon from '@/components/icon'
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/types').Poster} Poster */
  import {
    as_query_id,
    as_author,
    load_from_cache,
    load,
    as_layer_id
  } from '@/utils/itemid'
  import { get_item } from '@/utils/item'
  import { get } from 'idb-keyval'
  import {
    is_vector,
    is_vector_id,
    is_click,
    geology_layers
  } from '@/use/poster'
  import {
    cutout,
    boulders,
    rocks,
    gravel,
    sand,
    sediment
  } from '@/utils/preference'
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
    }
  })
  const emit = defineEmits({
    'vector-click': is_click,
    show: is_vector
  })
  const poster = ref(null)
  const vector = ref(null)
  const person = ref(null)
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
      await Promise.all(cutout_promises)
    }

    await tick()
    if (vector.value && vector.value.regular) {
      emit('show', vector.value)
      shown.value = true
      working.value = false
    }
  }

  provide('vector', vector)
  watch_effect(async () => {
    if (props.menu && !person.value) {
      const author_id = as_author(/** @type {Id} */ (props.itemid))
      // False positive: sequential assignment after async load
      // eslint-disable-next-line require-atomic-updates
      if (author_id) person.value = await load(/** @type {Id} */ (author_id))
    }
  })
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
    <as-svg :itemid="itemid" @show="on_show" :focusable="false" />
    <icon v-if="working" name="working" />
    <svg v-if="shown" style="display: none">
      <as-symbol-shadow />
      <as-symbol
        v-if="cutout && boulders && vector?.cutouts?.boulders"
        :itemid="as_layer_id(itemid, 'boulders')" />
      <as-symbol
        v-if="cutout && rocks && vector?.cutouts?.rocks"
        :itemid="as_layer_id(itemid, 'rocks')" />
      <as-symbol
        v-if="cutout && gravel && vector?.cutouts?.gravel"
        :itemid="as_layer_id(itemid, 'gravel')" />
      <as-symbol
        v-if="cutout && sand && vector?.cutouts?.sand"
        :itemid="as_layer_id(itemid, 'sand')" />
      <as-symbol
        v-if="cutout && sediment && vector?.cutouts?.sediment"
        :itemid="as_layer_id(itemid, 'sediment')" />
    </svg>
    <figcaption>
      <slot v-if="menu" />
    </figcaption>
  </figure>
</template>

<style lang="stylus">
  figure.poster {
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
      animation: focus-fade 1.2s ease-in-out;
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
        transition-property: all;
        position: relative;
      }
      &.working {
        min-height: 512px;
        padding: base-line * 6;
        margin-top: base-line;
        max-width: round(base-line * 6);
      }
    }
    svg.icon.working {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 3;
      width: round(base-line * 6);
      height: round(base-line * 6);
    }
    & > figcaption {

      menu {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: base-line;
        padding: base-line;
        height: auto;
        & > a {
          z-index: 2;
          position: relative;
          &.profile {
            animation-name: fade-in;
            animation-duration: 0.01s;
            padding: base-line * .33;
            background: black-transparent;
            border-radius: base-line * .25;
            standard-shadow: boop;
            position: absolute;
            top: base-line;
            left: base-line;
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
        }
        & > button {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: base-line * 0.25;
          padding: base-line * 0.25 base-line * 0.5;
          cursor: pointer;
          color: inherit;
          font-size: larger;
          line-height: 1;
          opacity: 0.7;
          min-width: base-line * 1.5;
          text-align: center;

          &:hover {
            opacity: 1;
            background: rgba(0, 0, 0, 0.5);
          }

          &:focus {
            outline: 0.25px solid currentColor;
            outline-offset: base-line * 0.25;
            opacity: 1;
          }
        }
      }
    }
  }

  @keyframes focus-fade {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
</style>
