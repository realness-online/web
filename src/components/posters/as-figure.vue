<script setup>
  import AsSvg from '@/components/posters/as-svg'
  import AsPosterSymbol from '@/components/posters/as-poster-symbol'
  import AsFigure from '@/components/profile/as-figure'
  import AsThought from '@/components/thoughts/as-thought'
  import AsAuthorMenu from '@/components/posters/as-menu-author'
  import { defineAsyncComponent as define_async_component } from 'vue'

  const AsViewer3d = define_async_component(
    () => import('@/components/posters/as-viewer-3d.vue')
  )
  const AsDownload = define_async_component(
    () => import('@/components/download-vector.vue')
  )
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/types').Poster} Poster */
  /** @typedef {import('@/types').Statement} Statement */
  import {
    as_query_id,
    as_author,
    as_created_at,
    load_from_cache,
    load
  } from '@/utils/itemid'
  import { as_time, as_day } from '@/utils/date'
  import { get } from 'idb-keyval'
  import { is_vector, is_vector_id, is_click } from '@/use/poster'
  import { mosaic, view_3d, enable_geology_layers } from '@/utils/preference'
  import { use_mask_pen } from '@/use/mask-pen'
  import { load_cutout_flags, GEOLOGY_DATE } from '@/utils/geology'
  import { load_shadow_into_vector } from '@/utils/poster-layers'
  import { use_poster_viewport_visibility } from '@/use/poster-viewport-visibility'
  import {
    poster_dom_id,
    poster_dom_href,
    POSTER_MEET_TOGGLE_ONLY
  } from '@/use/poster-dom-reference'
  import { use_poster_instance } from '@/use/poster-instances'
  import { use_poster_svg_activate_pointer } from '@/use/poster-svg-activate-pointer'
  import { use_delegated_pan } from '@/use/delegated-pan'
  import {
    ref,
    computed,
    getCurrentInstance as current_instance,
    watchEffect as watch_effect,
    watch,
    onUpdated as updated,
    onMounted as mounted,
    onBeforeUnmount as before_unmount,
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
    overlay_statements: {
      /** @type {import('vue').PropType<Statement[] | null>} */
      type: Array,
      default: null
    },
    overlay_editable: {
      type: Boolean,
      default: false
    },
    menu_always_visible: {
      type: Boolean,
      default: false
    },
    pin: {
      type: Boolean,
      default: false
    }
  })
  const emit = defineEmits({
    'vector-click': is_click,
    show: is_vector,
    remove: is_vector_id,
    missing: is_vector_id
  })
  const instance = current_instance()
  const mask_pen = use_mask_pen()
  provide('mask-pen', mask_pen)
  const poster = ref(null)
  provide('pan_delegator', use_delegated_pan(poster))
  const vector = ref(null)
  const person = ref(null)
  const menu_open = ref(false)
  const thought_overlay_open = ref(false)
  // Derived from FIT_HEIGHT / (2 * (camera_z - initial_zoom) * tan(FOV/2)) - tune to taste
  const SVG_ZOOM_SCALE = 1.59
  const canvas_alive = ref(false)
  const canvas_leaving = ref(false)
  const viewer_ref = ref(null)

  /** Click-to-toggle for every poster with overlay statements (own or read-only). */
  const overlay_text_visible = computed(() => {
    if (!props.overlay_statements?.length) return false
    if (mask_pen.active.value) return false
    return thought_overlay_open.value
  })

  const figcaption_visible = computed(
    () =>
      menu_open.value ||
      thought_overlay_open.value ||
      (props.menu && props.menu_always_visible) ||
      overlay_text_visible.value ||
      mask_pen.active.value
  )

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

  const toggle_mask_pen = () => {
    const will_activate = !mask_pen.active.value
    if (will_activate && !mosaic.value) {
      mosaic.value = true
      enable_geology_layers()
    }
    mask_pen.toggle_active()
    if (will_activate) menu_open.value = false
  }

  const on_window_pointerdown = e => {
    if (!mask_pen.active.value) return
    if (poster.value && !poster.value.contains(e.target))
      mask_pen.toggle_active()
  }

  const on_poster_svg_click = () => {
    if (mask_pen.active.value) return
    if (props.overlay_statements?.length) {
      thought_overlay_open.value = !thought_overlay_open.value
      if (!props.menu) menu_open.value = thought_overlay_open.value
    }
    vector_click()
  }
  /** True after `load_cutouts` wrote `vector.cutouts`; false after unload or new vector in `on_show`. */
  const cutouts_loaded = ref(false)
  const cutout_load_token = ref(0)
  /** Reads refs outside `load_cutouts` so `require-atomic-updates` does not pair with the post-await write. */
  const should_skip_cutout_load = () =>
    Boolean(cutouts_loaded.value && vector.value?.cutouts)

  provide('mask-pen-symbols-ready', cutouts_loaded)

  const query_id = computed(() => as_query_id(/** @type {Id} */ (props.itemid)))

  const {
    in_view: poster_in_view,
    fully_in_view: poster_fully_in_view,
    sync: sync_poster_visibility
  } = use_poster_viewport_visibility(poster)

  // Elect a single visible canonical per poster id; the rest reference it via <use>.
  const { am_canonical, use_reference, is_referenced } = use_poster_instance(
    () => /** @type {Id} */ (props.itemid),
    { el: poster, in_view: poster_in_view, kind: 'poster' }
  )
  const use_dom_reference = use_reference

  mounted(() => {
    if (typeof window !== 'undefined')
      window.addEventListener('pointerdown', on_window_pointerdown)
    tick().then(() => {
      sync_poster_visibility()
      scroll_to_hash_if_matching()
    })
  })

  const scroll_to_hash_if_matching = () => {
    if (typeof window === 'undefined') return
    const fragment = window.location.hash.substring(1)
    if (query_id.value === fragment && poster.value) {
      poster.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.location.hash = ''
    }
  }

  // When this poster is the referenced source, keep it fully rendered (pinned) with a warm
  // vector — the vector pre-loaded while it was referencing — so promotion never blanks.
  const sync_poster_for_svg = computed(() =>
    is_referenced.value && vector.value && is_vector(vector.value)
      ? vector.value
      : null
  )

  const poster_reference_href = computed(() =>
    poster_dom_href(/** @type {Id} */ (props.itemid))
  )
  const ref_dom_viewbox = ref('0 0 16 16')
  const ref_dom_preserve_aspect_ratio = ref('xMidYMid meet')
  const ref_dom_landscape = ref(false)

  const sync_reference_from_canonical = () => {
    const el = document.getElementById(
      poster_dom_id(/** @type {Id} */ (props.itemid))
    )
    if (!el || el.tagName !== 'svg') return
    const vb = el.getAttribute('viewBox')
    if (vb) ref_dom_viewbox.value = vb
    const par = el.getAttribute('preserveAspectRatio')
    if (par) ref_dom_preserve_aspect_ratio.value = par
    ref_dom_landscape.value =
      el.getAttribute('data-orientation') === 'horizontal'
  }

  const dom_reference_activate = () => {
    document.dispatchEvent(
      new CustomEvent(POSTER_MEET_TOGGLE_ONLY, {
        bubbles: true,
        detail: { itemid: props.itemid }
      })
    )
  }

  const {
    handle_pointerdown: handle_dom_ref_pointerdown,
    handle_pointermove: handle_dom_ref_pointermove,
    handle_pointerup: handle_dom_ref_pointerup,
    handle_pointerleave: handle_dom_ref_pointerleave
  } = use_poster_svg_activate_pointer({
    on_activate: dom_reference_activate,
    touch_uses_long_press: true
  })

  const poster_label = computed(() => {
    const created = as_created_at(/** @type {Id} */ (props.itemid))
    if (!created) return 'Poster'
    const day = as_day(new Date(created))
    return `Poster from ${day === 'Today' ? 'today' : day}`
  })
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
  const author_menu_poster = computed(() => ({
    id: props.itemid
  }))
  const profile_chip_itemid = computed(() =>
    props.profile_display === 'label'
      ? /** @type {Id | undefined} */ (props.itemid)
      : undefined
  )
  const shown = ref(false)
  const working = ref(true)
  const unload_cutouts = () => {
    cutout_load_token.value += 1
    if (vector.value?.cutouts) delete vector.value.cutouts
    cutouts_loaded.value = false
  }

  const load_cutouts = async () => {
    if (!vector.value) return
    if (should_skip_cutout_load()) return
    const token = cutout_load_token.value + 1
    cutout_load_token.value = token
    const next_cutouts = await load_cutout_flags(
      /** @type {Id} */ (props.itemid)
    )
    if (!vector.value || cutout_load_token.value !== token) return
    vector.value.cutouts = next_cutouts
    cutouts_loaded.value = true

    // If no cutout layers were found and this poster should have them,
    // the poster was likely deleted from storage. Signal the parent to
    // re-read the directory and remove stale entries.
    const created = as_created_at(/** @type {Id} */ (props.itemid))
    if (
      created &&
      created > GEOLOGY_DATE &&
      Object.keys(next_cutouts).length === 0
    )
      emit('missing', props.itemid)
  }

  const on_show = async shown_vector => {
    if (!shown_vector) return emit('missing', props.itemid)

    working.value = true
    cutouts_loaded.value = false
    vector.value = shown_vector

    if (!shown_vector.regular)
      try {
        vector.value = await load_shadow_into_vector(
          /** @type {Poster} */ (vector.value),
          /** @type {Id} */ (props.itemid)
        )
      } catch {
        // Shadows failed to load; continue with degraded display
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
    if (!use_dom_reference.value) return
    if (vector.value?.id === props.itemid) return
    const itemid_at_start = props.itemid
    const poster_loaded = await load(/** @type {Id} */ (itemid_at_start))
    if (props.itemid !== itemid_at_start) return
    if (poster_loaded) await on_show(/** @type {Poster} */ (poster_loaded))
  })
  watch(
    () => props.itemid,
    () => {
      if (use_dom_reference.value) sync_reference_from_canonical()
    }
  )
  watch_effect(async () => {
    const should_load_person = props.menu || menu_open.value
    if (should_load_person && !person.value) {
      const author_id = as_author(/** @type {Id} */ (props.itemid))
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
  const cutouts_active = computed(
    () =>
      poster_in_view.value || props.pin || view_3d.value || am_canonical.value
  )

  watch_effect(async () => {
    if (use_dom_reference.value) return
    const mosaic_on = mosaic.value
    const vector_id = vector.value?.id
    if (!vector_id) return
    if ((mosaic_on || view_3d.value) && cutouts_active.value) {
      await load_cutouts()
      return
    }
    if (props.pin) return
    unload_cutouts()
  })

  updated(() => {
    scroll_to_hash_if_matching()
  })

  const key_commands = inject('key-commands')
  const as_svg_ref = ref(null)

  const set_svg_zoom = t => {
    const svg = as_svg_ref.value?.$el
    if (!svg) return
    if (t <= 0) svg.style.scale = ''
    else svg.style.scale = String(1 + (SVG_ZOOM_SCALE - 1) * t)
  }

  const start_canvas_leave = () => {
    if (!canvas_alive.value || canvas_leaving.value) return
    canvas_leaving.value = true
    viewer_ref.value?.start_leave(set_svg_zoom, () => {
      canvas_alive.value = false
      canvas_leaving.value = false
    })
  }

  const want_3d = computed(
    () =>
      view_3d.value &&
      shown.value &&
      cutouts_loaded.value &&
      poster_fully_in_view.value
  )

  watch(want_3d, want => {
    if (want && !canvas_alive.value && !canvas_leaving.value)
      canvas_alive.value = true
    else if (!want && canvas_alive.value && !canvas_leaving.value)
      start_canvas_leave()
  })

  before_unmount(() => {
    if (typeof window !== 'undefined')
      window.removeEventListener('pointerdown', on_window_pointerdown)
  })

  const poster_toggle_target = () =>
    use_dom_reference.value
      ? { toggle_meet: dom_reference_activate }
      : as_svg_ref.value

  const handle_focusin = () => {
    key_commands?.add_context('Poster')
    key_commands?.register_handler('poster::Toggle_Meet_Slice', {
      handler: () => poster_toggle_target()?.toggle_meet?.(),
      context: 'Poster'
    })
  }

  const handle_focusout = () => {
    key_commands?.remove_context('Poster')
    key_commands?.unregister_handler('poster::Toggle_Meet_Slice')
  }

  const activate_poster = () => poster_toggle_target()?.toggle_meet?.()

  watch_effect(() => {
    if (!use_dom_reference.value) return
    sync_reference_from_canonical()
  })
</script>

<template>
  <figure
    ref="poster"
    class="poster"
    :aria-expanded="
      overlay_statements?.length ? overlay_text_visible : undefined
    "
    @focusin="handle_focusin"
    @focusout="handle_focusout"
    @keydown.enter.prevent="activate_poster">
    <svg
      v-if="use_dom_reference"
      itemscope
      itemtype="/posters"
      :itemid="itemid"
      :viewBox="ref_dom_viewbox"
      :preserveAspectRatio="ref_dom_preserve_aspect_ratio"
      role="img"
      aria-roledescription="referenced poster"
      :aria-label="poster_label"
      :data-orientation="ref_dom_landscape ? 'horizontal' : 'vertical'"
      @click="on_poster_svg_click"
      @pointerdown="handle_dom_ref_pointerdown"
      @pointermove="handle_dom_ref_pointermove"
      @pointerup="handle_dom_ref_pointerup"
      @pointerleave="handle_dom_ref_pointerleave"
      @pointercancel="handle_dom_ref_pointerleave"
      @contextmenu.prevent
      @selectstart.prevent>
      <use :href="poster_reference_href" />
      <rect
        role="presentation"
        aria-hidden="true"
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="transparent" />
    </svg>
    <as-svg
      v-else
      ref="as_svg_ref"
      :itemid="itemid"
      :slice="slice"
      :sync_poster="sync_poster_for_svg"
      :show_cutout_layers="cutouts_active && mosaic"
      :pin="props.pin"
      :paused="!poster_fully_in_view || canvas_alive"
      @show="on_show"
      @click="on_poster_svg_click"
      :focusable="false" />
    <as-poster-symbol
      v-if="shown && !use_dom_reference"
      :itemid="itemid"
      :vector="vector"
      :show_cutout_symbols="cutouts_active && mosaic"
      :shown="shown" />
    <as-viewer-3d
      v-if="canvas_alive"
      ref="viewer_ref"
      :itemid="itemid"
      :on_svg_zoom="set_svg_zoom"
      class="inline"
      @select="on_poster_svg_click" />
    <figcaption v-if="figcaption_visible">
      <header>
        <aside v-if="overlay_text_visible" aria-live="polite">
          <as-thought
            v-for="stmt in overlay_statements"
            :key="stmt.id"
            :thought="stmt"
            :editable="overlay_editable" />
        </aside>
      </header>
      <template
        v-if="
          menu_open || (menu && menu_always_visible) || mask_pen.active.value
        ">
        <footer>
          <router-link
            v-if="
              poster_time &&
              is_my_poster &&
              profile_path &&
              !mask_pen.active.value
            "
            :to="profile_path">
            <time>{{ poster_time }}</time>
          </router-link>
          <time v-else-if="poster_time && !mask_pen.active.value">{{
            poster_time
          }}</time>
          <slot>
            <menu
              v-if="is_my_poster"
              :style="
                mask_pen.active.value && mask_pen.painting.value
                  ? { opacity: 0.12, pointerEvents: 'none' }
                  : null
              ">
              <button
                class="mask-pen"
                :class="{ active: mask_pen.active.value }"
                @click.stop="toggle_mask_pen">
                &#9998;<span v-if="mask_pen.selected.value.size">
                  {{ mask_pen.selected.value.size }}</span
                >
              </button>
              <button
                v-if="mask_pen.active.value && mask_pen.selected.value.size"
                class="mask-pen-clear"
                @click.stop="mask_pen.clear()">
                &times;
              </button>
              <as-author-menu
                v-if="!mask_pen.active.value"
                :poster="author_menu_poster"
                :allow_remove="has_remove_handler"
                @remove="id => emit('remove', id)" />
            </menu>
            <menu v-else>
              <as-figure
                v-if="person"
                :person="person"
                :display="profile_display"
                :itemid="profile_chip_itemid" />
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
    border-radius: round((base-line * .03), 2);
    grid-row-start: span 2;
    transition:
      grid-column-start 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      grid-column-end 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      grid-row-start 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      grid-row-end 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      min-height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    scroll-margin: 50vh;
    scroll-snap-align: center;
    &[aria-expanded='false']::after {
      content: '';
      position: absolute;
      top: round((base-line * 0.18), 2);
      right: round((base-line * 0.18), 2);
      bottom: round((base-line * 0.18), 2);
      left: round((base-line * 0.18), 2);
      z-index: 2;
      pointer-events: none;
      border: round((base-line * 0.1), 2) solid unquote('color-mix(in srgb, var(--accent) 88%, transparent)');
      border-radius: round((base-line * 0.28), 2);
    }
    &:has(svg[data-aspect]) {
      grid-column-start: span 3;
      grid-row-start: auto;
    }
    &:focus {
      outline: 0.25px solid var(--emphasis);
      outline-offset: base-line * 0.25;
    }
    @media (orientation: landscape), (min-width: page-width) {
      &:has(svg[data-orientation='horizontal']) {
        grid-column-start: span 2;
        grid-row-start: auto;
        width: 100%;
        min-height: auto;
        &.new {
          grid-column-start: span 2;
        }
        &:has(svg[data-aspect]) {
          grid-column-start: span 2;
        }
      }
    }
    @media (min-width: pad-begins) {
      &:has(svg[data-orientation='horizontal']):has(+ figure.poster:has(svg[data-orientation='horizontal'])) {
        grid-column-start: span 3;
      }
      &:has(svg[data-orientation='horizontal']) + figure.poster:has(svg[data-orientation='horizontal']) {
        grid-column-start: span 3;
      }
      &.new:not(:has(svg[data-orientation='horizontal'])) {
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
    /* Keep `content-visibility` off the figure so figcaption (overlay text) is not skipped; Safari mishandles the subtree when the root has `auto`. */
    & > svg:not([data-poster-symbol-defs]) {
      content-visibility: auto;
      contain-intrinsic-size: auto 512px;
    }
    svg[aria-roledescription='referenced poster'] {
      display: block;
      min-height: 512px;
      height: 100%;
      width: 100%;
      overflow: hidden;
      cursor: pointer;
      disable-ios-touch-callout();
      touch-action: pan-y;
      contain: layout;
      max-height: 100%;
    }
    svg[aria-roledescription='referenced poster'] rect[role='presentation'][aria-hidden='true'] {
      pointer-events: all;
    }
    @media (prefers-reduced-motion: reduce) {
      transition-duration: 0.01ms;
    }
    .viewer_3d.inline {
      position: absolute;
      inset: 0;
      z-index: 2;
      disable-ios-touch-callout();
      border-radius: round((base-line * .03), 2);
      overflow: hidden;
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
          frosted-glass();
          color: var(--text);
          box-shadow:
            0 0.08em 0.6em unquote('color-mix(in srgb, var(--basalt) 5%, transparent)'),
            0 0.15em 0.5em unquote('color-mix(in srgb, var(--moonlight) 15%, transparent)');
          @media (prefers-color-scheme: dark) {
            box-shadow:
              0 0.08em 0.6em unquote('color-mix(in srgb, var(--moonlight) 35%, transparent)'),
              0 0.2em 0.65em unquote('color-mix(in srgb, var(--moonlight) 45%, transparent)');
          }
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
        }
      }
      & > footer {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: base-line * 0.5;
        & > a:has(> time) {
          pointer-events: auto;
          text-decoration: none;
          &:hover > time,
          &:focus-visible > time {
            text-decoration: underline;
          }
        }
        & > a > time,
        & > time {
          color: var(--accent);
          white-space: nowrap;
          padding: base-line * 0.2 base-line * 0.4;
          border-radius: base-line * 0.25;
          frosted-glass();
        }
      }

      & > footer > menu {
        frosted-glass();
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
        & > button.mask-pen,
        & > button.mask-pen-clear {
          background: unquote('color-mix(in srgb, var(--moonlight) 30%, transparent)');
          border: 1px solid unquote('color-mix(in srgb, var(--bone) 30%, transparent)');
          border-radius: base-line * 0.25;
          padding: base-line * 0.25 base-line * 0.5;
          cursor: pointer;
          color: white;
          font-size: larger;
          line-height: 1;
          opacity: 0.7;
          min-width: base-line * 1.5;
          text-align: center;
          &:hover { opacity: 1; background: unquote('color-mix(in srgb, var(--moonlight) 50%, transparent)'); }
        }
        & > button.mask-pen.active {
          opacity: 1;
          background: unquote('color-mix(in srgb, var(--slate-fill) 50%, transparent)');
          border-color: unquote('color-mix(in srgb, var(--slate-fill) 80%, transparent)');
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
          frosted-glass();
          border-radius: base-line * .25;
          & > address {
            & > h3:first-of-type {
              margin-right: base-line * .333;
            }
            & > h3,
            & > time {
              color: var(--accent);
              line-height: 1;
            }
          }
        }
        & > a.profile > svg,
        & > figure.profile > svg,
        & > span.actions svg {
         fill: var(--accent);
        }
      }

      & > footer > menu menu {
        background: transparent;
        backdrop-filter: none;
        padding: 0;
        border-radius: 0;
        min-width: auto;
        max-width: none;
      }
    }
  }
</style>
