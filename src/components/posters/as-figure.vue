<script setup>
  import AsSvg from '@/components/posters/as-svg'
  import AsPosterSymbol from '@/components/posters/as-poster-symbol'
  import AsFigure from '@/components/profile/as-figure'
  import AsThought from '@/components/thoughts/as-thought'
  import AsAuthorMenu from '@/components/posters/as-menu-author'
  import AsDownload from '@/components/download-vector'
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/types').Poster} Poster */
  /** @typedef {import('@/types').Statement} Statement */
  import {
    as_query_id,
    as_author,
    as_created_at,
    load_from_cache,
    load,
    as_layer_id
  } from '@/utils/itemid'
  import { as_time } from '@/utils/date'
  import { get_item } from '@/utils/item'
  import { get } from 'idb-keyval'
  import {
    is_vector,
    is_vector_id,
    is_click,
    geology_layers
  } from '@/use/poster'
  import { mosaic } from '@/utils/preference'
  import { use_delegated_pan } from '@/use/delegated-pan'
  import {
    ref,
    computed,
    getCurrentInstance as current_instance,
    watchEffect as watch_effect,
    watch,
    onUpdated as updated,
    nextTick as tick,
    provide,
    inject
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
    },
    profile_display: {
      type: String,
      default: 'label',
      validator: v => ['label', 'phonebook'].includes(v)
    },
    /** Statements merged into this poster (same thought); shown in overlay */
    overlay_statements: {
      /** @type {import('vue').PropType<Statement[] | null>} */
      type: Array,
      default: null
    },
    overlay_editable: {
      type: Boolean,
      default: false
    },
    picker_selected: {
      type: Boolean,
      default: false
    },
    /** When true with menu, footer stays visible and clicks do not toggle it (e.g. profile hero). */
    menu_always_visible: {
      type: Boolean,
      default: false
    },
    /** Load poster immediately; cutouts/shadows do not wait on IntersectionObserver (e.g. profile page). */
    eager: {
      type: Boolean,
      default: false
    }
  })
  const emit = defineEmits({
    'vector-click': is_click,
    show: is_vector,
    remove: is_vector_id,
    picker: is_vector_id
  })
  const instance = current_instance()
  const poster = ref(null)
  provide('pan_delegator', use_delegated_pan(poster))
  const vector = ref(null)
  const person = ref(null)
  const menu_open = ref(false)
  const thought_overlay_open = ref(false)

  watch(
    () => props.overlay_statements,
    () => {
      thought_overlay_open.value = false
    }
  )

  const vector_click = () => {
    if (!props.menu) return
    if (props.menu_always_visible) return
    menu_open.value = !menu_open.value
  }

  const on_poster_svg_click = () => {
    if (props.overlay_statements?.length) {
      thought_overlay_open.value = !thought_overlay_open.value
      if (!props.menu) menu_open.value = thought_overlay_open.value
    }
    vector_click()
  }
  const aggressive_cutout_mode = true
  const cutouts_loaded = ref(false)
  const cutout_load_token = ref(0)
  const poster_in_view = ref(false)
  const effective_in_view = computed(() => props.eager || poster_in_view.value)

  const query_id = computed(() => as_query_id(/** @type {Id} */ (props.itemid)))
  const poster_time = computed(() => {
    const created_at = as_created_at(/** @type {Id} */ (props.itemid))
    if (!created_at) return ''
    return as_time(new Date(created_at))
  })
  const profile_path = computed(
    () => as_author(/** @type {Id} */ (props.itemid)) || ''
  )
  const is_my_poster = computed(() => {
    if (typeof window === 'undefined') return false
    const my_id = window.localStorage?.me
    if (!my_id) return false
    return profile_path.value === my_id
  })
  const has_remove_handler = computed(() => !!instance?.vnode.props?.onRemove)
  const has_picker_handler = computed(() => !!instance?.vnode.props?.onPicker)
  const author_menu_poster = computed(() => ({
    id: props.itemid,
    picker: props.picker_selected
  }))
  const shown = ref(false)
  const working = ref(true)
  const unload_cutouts = () => {
    cutout_load_token.value += 1
    if (vector.value?.cutouts) delete vector.value.cutouts
    cutouts_loaded.value = false
  }

  const load_cutouts = async () => {
    if (!vector.value || vector.value.cutouts) return
    const token = cutout_load_token.value + 1
    cutout_load_token.value = token
    const next_cutouts = {}
    await Promise.all(
      geology_layers.map(async layer => {
        const layer_id = as_layer_id(/** @type {Id} */ (props.itemid), layer)
        const html_string = await get(layer_id)
        if (html_string) next_cutouts[layer] = true
        else {
          const { html } = await load_from_cache(layer_id)
          if (html) next_cutouts[layer] = true
        }
      })
    )
    if (!vector.value || cutout_load_token.value !== token) return
    vector.value.cutouts = next_cutouts
    cutouts_loaded.value = true
  }

  const on_show = async shown_vector => {
    if (!shown_vector) return

    working.value = true
    vector.value = shown_vector
    cutouts_loaded.value = false

    if (!shown_vector.regular) {
      const shadow_id = as_layer_id(/** @type {Id} */ (props.itemid), 'shadows')
      let html_string = await get(shadow_id)
      let pattern = null
      try {
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
      } catch {
        // Shadows failed to load; continue with degraded display
      }
    }

    if (vector.value && vector.value.regular) {
      await tick()
      emit('show', vector.value)
      shown.value = true
    }
    working.value = false
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
  watch_effect(async () => {
    const in_view = effective_in_view.value
    const mosaic_on = mosaic.value
    const vector_id = vector.value?.id
    if (!vector_id) return
    if (in_view && mosaic_on) {
      await load_cutouts()
      return
    }
    if (aggressive_cutout_mode) unload_cutouts()
  })

  updated(() => {
    const fragment = window.location.hash.substring(1)
    if (query_id.value === fragment && poster.value) {
      poster.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.location.hash = ''
    }
  })

  const key_commands = inject('key-commands')
  const as_svg_ref = ref(null)

  const handle_focusin = () => {
    key_commands?.add_context('Poster')
    key_commands?.register_handler('poster::Toggle_Meet_Slice', {
      handler: () => as_svg_ref.value?.toggle_meet(),
      context: 'Poster'
    })
  }

  const handle_focusout = () => {
    key_commands?.remove_context('Poster')
    key_commands?.unregister_handler('poster::Toggle_Meet_Slice')
  }

  const activate_poster = () => as_svg_ref.value?.toggle_meet()
  const on_in_view = visible => {
    poster_in_view.value = visible
  }
</script>

<template>
  <figure
    ref="poster"
    class="poster"
    :class="{
      'has-thought-text': overlay_statements?.length,
      'thought-overlay-open': thought_overlay_open && overlay_statements?.length
    }"
    @focusin="handle_focusin"
    @focusout="handle_focusout"
    @keydown.enter.prevent="activate_poster">
    <as-svg
      ref="as_svg_ref"
      :itemid="itemid"
      :slice="slice"
      :eager="eager"
      :show_cutout_layers="effective_in_view && mosaic"
      @show="on_show"
      @in_view="on_in_view"
      @click="on_poster_svg_click"
      :focusable="false" />
    <as-poster-symbol
      :itemid="itemid"
      :vector="vector"
      :show_cutout_symbols="effective_in_view && mosaic"
      :shown="shown" />
    <figcaption
      v-if="menu_open || thought_overlay_open || (menu && menu_always_visible)">
      <header>
        <aside
          v-if="overlay_statements?.length && thought_overlay_open"
          aria-live="polite">
          <as-thought
            v-for="stmt in overlay_statements"
            :key="stmt.id"
            :thought="stmt"
            :editable="overlay_editable" />
        </aside>
      </header>
      <template v-if="menu_open || (menu && menu_always_visible)">
        <footer>
          <router-link
            v-if="poster_time && is_my_poster && profile_path"
            class="poster-time-link"
            :to="profile_path">
            <time>{{ poster_time }}</time>
          </router-link>
          <time v-else-if="poster_time">{{ poster_time }}</time>
          <slot>
            <as-author-menu
              v-if="is_my_poster"
              :poster="author_menu_poster"
              :allow_remove="has_remove_handler"
              :allow_picker="has_picker_handler"
              @remove="id => emit('remove', id)"
              @picker="id => emit('picker', id)" />
            <menu v-else>
              <as-figure
                v-if="person"
                :person="person"
                :display="profile_display"
                :poster_itemid="
                  profile_display === 'label' ? itemid : undefined
                " />
              <span class="actions">
                <as-download :itemid="/** @type {Id} */ (itemid)" />
              </span>
            </menu>
          </slot>
        </footer>
      </template>
    </figcaption>
  </figure>
</template>

<style lang="stylus">
  figure.poster {
    position: relative;
    display: grid;
    overflow: hidden;
    min-height: 512px;
    content-visibility: auto;
    contain-intrinsic-size: auto 512px;
    border-radius: round((base-line * .03), 2);
    grid-row-start: span 2;
    transition:
      grid-column-start 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      grid-column-end 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      grid-row-start 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      grid-row-end 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      min-height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.4s cubic-bezier(0.22, 1, 0.36, 1)
    scroll-margin: 50vh;
    scroll-snap-align: center;
    &.has-thought-text:not(.thought-overlay-open)::after {
      content: '';
      position: absolute;
      top: round((base-line * 0.18), 2);
      right: round((base-line * 0.18), 2);
      bottom: round((base-line * 0.18), 2);
      left: round((base-line * 0.18), 2);
      z-index: 2;
      pointer-events: none;
      border: round((base-line * 0.1), 2) solid hsla(180, 30%, 45%, 0.88);
      border-radius: round((base-line * 0.28), 2);
      @media (prefers-color-scheme: dark) {
        border-color: hsla(180, 35%, 58%, 0.9);
      }
    }
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
          grid-column-start: span 2;
        }
      }
    }
    @media (min-width: pad-begins) {
      &:has(svg.landscape):has(+ figure.poster:has(svg.landscape)) {
        grid-column-start: span 3;
      }
      &:has(svg.landscape) + figure.poster:has(svg.landscape) {
        grid-column-start: span 3;
      }
      &.new:not(:has(svg.landscape)) {
        grid-column: 2;
        grid-row: 2;
      }
    }
    svg {
      z-index: 1;
      &[itemscope] {
        grid-area: 1 / 1;
        position: relative;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      transition-duration: 0.01ms;
    }
    & > figcaption {
      grid-area: 1 / 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transform: none;
      z-index: 3;
      pointer-events: none;
      padding: base-line;
      & > header {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: base-line * 0.5;
        flex: 1;
        min-height: 0;
        pointer-events: none;
        & > aside {
          display: block ;
          min-height: 0;
          max-height: none;
          overflow-y: auto;
          overflow-x: hidden;
          z-index: 2;
          padding: base-line * 0.75 base-line;
          border-radius: base-line * 0.5;
          background: white-background;
          color: black;
          box-shadow:
            0 0.08em 0.6em black-barely,
            0 0.15em 0.5em hsla(228, 9.8%, 6%, 0.12);
          -webkit-overflow-scrolling: touch;
          pointer-events: auto;
          & p[itemprop='statement'] {
            margin: 0 0 round((base-line * 0.35), 2) 0;
            font-size: 0.95em;
            line-height: 1.45;
            white-space: pre-wrap;
            word-break: break-word;
            &:last-child {
              margin-bottom: 0;
            }
          }
          @media (prefers-color-scheme: dark) {
            background: hsla(228, 9.8%, 12%, 0.92);
            color: white-text;
            box-shadow:
              0 0.08em 0.6em hsla(0, 0%, 0%, 0.35),
              0 0.2em 0.65em hsla(0, 0%, 0%, 0.45);
          }
        }
      }
      & > footer {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: base-line * 0.5;
        & > a.poster-time-link {
          pointer-events: auto;
          text-decoration: none;
          &:hover > time,
          &:focus-visible > time {
            text-decoration: underline;
          }
        }
        & > a.poster-time-link > time,
        & > time {
          color: blue;
          white-space: nowrap;
          padding: base-line * 0.2 base-line * 0.4;
          border-radius: base-line * 0.25;
          background: black-transparent;
          standard-shadow: boop;
        }
      }

      menu {
        pointer-events: auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: base-line * 0.5;
        padding: base-line * 0.5;
        height: auto;
        border-radius: base-line;
        background: black-transparent;
        min-width: 0;
        max-width: page-width;
        svg[itemtype='/posters'] {
          min-height: auto;
        }
        & > a,
        & > figure,
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
        & > a.profile,
        & > figure.profile {
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
        & > figure.profile > svg,
        & > span.actions svg {
          fill: blue;
        }
      }
    }
  }
</style>
