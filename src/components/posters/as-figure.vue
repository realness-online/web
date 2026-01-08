<script setup>
  /* eslint-disable vue/no-static-inline-styles */
  import AsDownload from '@/components/download-vector'
  import AsDownloadVideo from '@/components/download-video'
  import AsMessenger from '@/components/profile/as-messenger'
  import AsLink from '@/components/profile/as-link'
  import AsSvg from '@/components/posters/as-svg'
  import AsSymbol from '@/components/posters/as-symbol'
  import AsSymbolShadow from '@/components/posters/as-symbol-shadow'
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/types').Poster} Poster */
  import {
    as_query_id,
    as_author,
    load,
    as_created_at,
    as_layer_id
  } from '@/utils/itemid'
  import { is_vector, is_vector_id, is_click } from '@/use/poster'
  import { as_time } from '@/utils/date'
  import { current_user } from '@/utils/serverless'
  import {
    cutout,
    boulder,
    rock,
    gravel,
    sand,
    sediment,
    show_menu
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
    }
  })
  const emit = defineEmits({
    'vector-click': is_click,
    show: is_vector
  })
  const menu = ref(false)
  const poster = ref(null)
  const vector = ref(null)
  const person = ref(null)
  const symbol_loaded = ref({
    boulder: false,
    rock: false,
    gravel: false,
    sand: false,
    sediment: false
  })

  const query_id = computed(() => as_query_id(props.itemid))
  const posted_at = computed(() => as_time(as_created_at(props.itemid)))
  const shown = ref(false)
  const has_been_focused = ref(false)
  const vector_click = () => {
    menu.value = !menu.value
    emit('vector-click', menu.value)
  }
  const handle_focus = () => {
    if (!has_been_focused.value) {
      has_been_focused.value = true
      if (poster.value)
        poster.value.setAttribute('data-has-been-focused', 'true')
    }
  }

  const on_show = async shown_vector => {
    if (!shown_vector) return

    vector.value = shown_vector

    if (!shown_vector.regular) {
      const pattern = await load(as_layer_id(props.itemid, 'shadow'))
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

    await tick()
    if (vector.value && vector.value.regular) {
      emit('show', vector.value)
      shown.value = true
    }
  }

  provide('vector', vector)
  watch_effect(async () => {
    if (menu.value && !person.value) {
      const author_id = as_author(props.itemid)
      // False positive: sequential assignment after async load
      // eslint-disable-next-line require-atomic-updates
      if (author_id) person.value = await load(author_id)
    }
  })
  watch(cutout, new_value => {
    if (!new_value)
      symbol_loaded.value = {
        boulder: false,
        rock: false,
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
  <figure ref="poster" class="poster" @focus="handle_focus">
    <figcaption>
      <button
        v-if="show_menu && !menu"
        @click="vector_click"
        aria-label="Show menu">
        …
      </button>
      <menu v-if="menu">
        <as-link :itemid="itemid">
          <time>{{ posted_at }}</time>
        </as-link>
        <as-download :itemid="itemid" />
        <as-download-video :itemid="itemid" />
        <as-messenger v-if="current_user" :itemid="itemid" />
      </menu>
    </figcaption>
    <as-svg
      :itemid="itemid"
      @click="vector_click"
      @show="on_show"
      :focusable="false" />
    <!-- Hidden SVG defs container, not user-facing style -->
    <svg v-if="shown" style="display: none">
      <as-symbol-shadow />
      <as-symbol
        v-if="cutout && boulder && vector?.boulder"
        :itemid="as_layer_id(itemid, 'boulder')" />
      <as-symbol
        v-if="cutout && rock && vector?.rock"
        :itemid="as_layer_id(itemid, 'rock')" />
      <as-symbol
        v-if="cutout && gravel && vector?.gravel"
        :itemid="as_layer_id(itemid, 'gravel')" />
      <as-symbol
        v-if="cutout && sand && vector?.sand"
        :itemid="as_layer_id(itemid, 'sand')" />
      <as-symbol
        v-if="cutout && sediment && vector?.sediment"
        :itemid="as_layer_id(itemid, 'sediment')" />
    </svg>
  </figure>
</template>

<style lang="stylus">
  figure.poster {
    min-height: 512px;
    border-radius: round((base-line * .03), 2);
    position: relative;
    overflow: hidden;
    grid-row-start: span 2;
    scroll-margin: 50vh;
    scroll-snap-align: center;
    &:has(svg[style*='aspect-ratio']) {
      grid-column-start: span 3;
      grid-row-start: auto;
    }
    &:focus:not([data-has-been-focused="true"]) {
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
    & > figcaption {
      position: absolute;
      top: base-line;
      right: base-line;
      z-index: 2;

      button {
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

      menu {
      height: 0;
      & > a {
        z-index: 2;
        position: absolute;
      &.download {
          bottom: base-line;
          right: base-line;
        }
        &.profile {
          animation-name: fade-in;
          animation-duration: 0.01s;
          padding: base-line * .33;
          background: black-transparent;
          border-radius: base-line * .25;
          standard-shadow: boop;
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
