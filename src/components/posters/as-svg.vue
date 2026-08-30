<script setup>
  import AsMasks from '@/components/posters/as-masks'
  import AsGradients from '@/components/posters/as-gradients'
  import AsAnimation from '@/components/posters/as-animation'
  import AsMaskPen from '@/components/posters/as-mask-pen'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import {
    watchEffect as watch_effect,
    onMounted as mounted,
    onUnmounted as unmounted,
    nextTick as tick,
    ref,
    watch,
    computed,
    provide,
    inject
  } from 'vue'
  import {
    useDocumentVisibility,
    useMediaQuery,
    useElementSize
  } from '@vueuse/core'
  import {
    use as use_poster,
    is_vector,
    is_vector_id,
    geology_layers,
    has_drawable_layer
  } from '@/use/poster'
  import { use_deferred_unmount, duration_of } from '@/use/deferred-unmount'
  import {
    animate as animate_pref,
    drama_back,
    drama_front,
    shadow,
    stroke,
    background,
    light,
    regular,
    medium,
    bold,
    mosaic,
    boulders,
    rocks,
    gravel,
    sand,
    sediment,
    storytelling,
    aspect_ratio_mode,
    slice_alignment,
    grid,
    camera_y
  } from '@/utils/preference'
  import { as_layer_id, as_fragment_id, as_created_at } from '@/utils/itemid'
  import { as_day } from '@/utils/date'
  import { POSTER_MEET_TOGGLE_ONLY } from '@/use/poster-dom-reference'
  import { use_poster_svg_activate_pointer } from '@/use/poster-svg-activate-pointer'
  import {
    poster_landscape,
    slice_preserve_aspect_ratio,
    camera_travel,
    camera_bounds
  } from '@/use/poster-aspect'
  import { report_camera_reach } from '@/use/camera'
  import { is_symbol_ready } from '@/use/symbol-ready'
  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    },
    sync_poster: {
      type: Object,
      required: false,
      default: null,
      validator: is_vector
    },
    slice: {
      type: Boolean,
      default: undefined
    },
    show_cutout_layers: {
      type: Boolean,
      default: undefined
    },
    pin: {
      type: Boolean,
      default: false
    },
    touch_uses_long_press: {
      type: Boolean,
      default: true
    },
    as_avatar: {
      type: Boolean,
      default: false
    },
    paused: {
      type: Boolean,
      default: false
    },
    tabable: {
      type: Boolean,
      default: false
    },
    /**
     * The 3D canvas is alive over this poster. The svg is scaled scenery behind
     * it (see `set_svg_zoom` in as-figure), so it takes no gestures: no swipe,
     * no zoom, no activation, and the callout stays blocked like the canvas.
     */
    behind_canvas: {
      type: Boolean,
      default: false
    }
  })
  const emit = defineEmits(['focus', 'click', 'show', 'intersecting'])
  const mask_pen = inject('mask-pen', null)
  const mask_pen_active = computed(() => mask_pen?.active.value ?? false)
  const poster_label = computed(() => {
    const created = as_created_at(
      /** @type {import('@/types').Id} */ (props.itemid)
    )
    if (!created) return 'Poster'
    const day = as_day(new Date(created))
    return `Poster from ${day === 'Today' ? 'today' : day}`
  })
  const { query, show, tabindex, vector, intersecting, viewbox, working } =
    use_poster()

  const poster_slice = computed(() => props.slice ?? false)
  const use_meet = ref(false)

  const cutouts_enabled = computed(() =>
    props.show_cutout_layers !== undefined
      ? props.show_cutout_layers
      : mosaic.value
  )

  const aspect_ratio = computed(() =>
    use_meet.value
      ? 'xMidYMid meet'
      : slice_preserve_aspect_ratio(slice_alignment.value || 'ymid')
  )

  const cutouts_mounted = computed(
    () => (intersecting.value || props.pin) && cutouts_enabled.value
  )

  /**
   * The group has to outlive the mosaic switch, or turning cutouts off takes
   * the whole subtree away on the same frame and the layers inside never get
   * to fade. Offscreen still unmounts immediately - nothing was visible.
   */
  const cutouts_held = computed(
    () =>
      (intersecting.value || props.pin) &&
      (cutouts_enabled.value || held_layers.value.length > 0)
  )

  const layer_from_target = el => {
    const use_el = el?.closest?.('use[itemprop]')
    if (!use_el) return null
    const prop = use_el.getAttribute('itemprop')
    if (prop === 'shadow' || geology_layers.includes(prop)) return prop
    return null
  }

  const on_click = () => {
    use_meet.value = !use_meet.value
    emit('click', true)
  }

  const on_meet_toggle_only_doc = e => {
    if (e.detail?.itemid !== props.itemid) return
    use_meet.value = !use_meet.value
  }

  const trigger = ref(null)
  const visibility = useDocumentVisibility()
  const animate = computed(
    () =>
      animate_pref.value === true &&
      !props.as_avatar &&
      !props.paused &&
      visibility.value === 'visible'
  )
  /**
   * `paused` is already false only while the poster is fully in view - see
   * `as-figure`. Morph rides on that, so a directory grid never builds one.
   */
  const in_view = computed(
    () => !props.as_avatar && !props.paused && visibility.value === 'visible'
  )
  const landscape = computed(() => poster_landscape(vector.value?.viewbox))

  const valid_vector = computed(() => {
    if (!vector.value) return null
    if (is_vector(vector.value)) return vector.value
    return null
  })

  defineExpose({ toggle_meet: on_click })

  provide('vector', vector)

  mounted(async () => {
    document.addEventListener(POSTER_MEET_TOGGLE_ONLY, on_meet_toggle_only_doc)
    if (props.sync_poster) {
      intersecting.value = true
      emit('intersecting', true)
      vector.value = props.sync_poster
      emit('show', vector.value)
    } else {
      use_intersect(trigger, ([{ isIntersecting }]) => {
        intersecting.value = isIntersecting
        emit('intersecting', isIntersecting)
        if (isIntersecting) show()
      })
      if (props.as_avatar && !vector.value) await show()
      await tick()
      if (props.pin && !vector.value) await show()
    }
    await tick()
  })

  watch_effect(() => {
    if (props.sync_poster) {
      intersecting.value = true
      emit('intersecting', true)
      vector.value = props.sync_poster
      emit('show', vector.value)
    } else if (props.sync_poster === null) vector.value = null
  })

  const is_loading = computed(() => {
    if (!intersecting.value) return false
    if (working.value) return true
    if (!vector.value) return true
    if (!has_drawable_layer(vector.value)) return true
    return false
  })
  const drama_back_visible = computed(
    () => drama_back.value || is_loading.value
  )
  const drama_front_visible = computed(
    () => drama_front.value || is_loading.value
  )

  /**
   * Any shadow geometry actually drawing. The group switch is not enough: with
   * every individual layer off there is nothing underneath, however `shadow`
   * itself is set.
   */
  const shadow_layers_on = computed(
    () =>
      background.value ||
      light.value ||
      regular.value ||
      medium.value ||
      bold.value
  )

  const shadow_layer_displayed = computed(
    () => (shadow.value || stroke.value) && shadow_layers_on.value
  )

  /** Shadow fills resting under the cutouts - what dims them the most. */
  const shadow_fill_displayed = computed(
    () => shadow.value && shadow_layers_on.value
  )

  /** Only the outlines are down there, so the cutouts can come up a little. */
  const stroke_only = computed(
    () => !shadow.value && stroke.value && shadow_layers_on.value
  )

  const viewbox_rect = computed(() => {
    const [x, y, width, height] = viewbox.value.split(' ').map(Number)
    return { x, y, width, height }
  })

  const grid_visible = computed(() => grid.value)

  const hide_cursor = computed(() => poster_slice.value && storytelling.value)

  const orientation_portrait = useMediaQuery('(orientation: portrait)')
  /**
   * Only a landscape poster overflows a portrait frame. Measuring the rect
   * can't answer this: `landscape` is not persisted on the item, so until the
   * vector loads the viewBox makes every poster look like it fits.
   */
  /**
   * useElementSize starts at zero and only fills in after its observer runs,
   * which never happens in a test environment, so fall back to a live measure.
   */
  const measured_frame = computed(() => {
    if (frame_width.value && frame_height.value)
      return { width: frame_width.value, height: frame_height.value }
    const rect = trigger.value?.getBoundingClientRect()
    return { width: rect?.width || 0, height: rect?.height || 0 }
  })

  const can_pan = computed(
    () =>
      orientation_portrait.value &&
      landscape.value &&
      !use_meet.value &&
      !storytelling.value &&
      !props.behind_canvas
  )
  // Measured, not read on demand: a computed that calls
  // getBoundingClientRect() never re-runs on a resize or a rotation, so the
  // framing would stay wherever it was when the poster first drew.
  const { width: frame_width, height: frame_height } = useElementSize(trigger)

  const max_pan_px = computed(() => {
    if (!can_pan.value || !trigger.value || !vector.value) return 0
    const rect = measured_frame.value
    const [, , content_width, content_height] = vector.value.viewbox
      .split(' ')
      .map(Number)
    const content_aspect = content_width / content_height
    const container_aspect = rect.width / rect.height
    if (content_aspect <= container_aspect) return 0
    const scale = rect.height / content_height
    const scaled_width = content_width * scale
    const overflow = scaled_width - rect.width
    return Math.max(0, overflow / 2)
  })

  /**
   * Tell the camera what this poster can use, so it stops where the posters on
   * screen stop instead of counting on past them.
   */
  const camera_reachable = computed(() => {
    if (!intersecting.value && !props.pin) return null
    if (use_meet.value || props.behind_canvas) return null
    if (!vector.value) return null
    const rect = measured_frame.value
    const { up, down, frame } = camera_bounds({
      width: rect.width,
      height: rect.height,
      viewbox: vector.value.viewbox,
      alignment: slice_alignment.value || 'ymid'
    })
    if (!frame) return null
    return { up, down }
  })

  watch_effect(() => report_camera_reach(props.itemid, camera_reachable.value))
  unmounted(() => report_camera_reach(props.itemid, null))

  /** Where the camera sits on this poster, in viewBox units. */
  const camera_offset = computed(() => {
    if (use_meet.value || props.behind_canvas) return 0
    if (!trigger.value || !vector.value) return 0
    const rect = measured_frame.value
    return camera_travel({
      width: rect.width,
      height: rect.height,
      viewbox: vector.value.viewbox,
      alignment: slice_alignment.value || 'ymid',
      at: camera_y.value
    })
  })

  const pan_delegator = inject('pan_delegator', null)
  let pan_offset
  let panning
  let pan_unregister = null

  let was_pan_gesture
  if (pan_delegator) {
    const delegated = pan_delegator.register(trigger, {
      get_can_pan: () => can_pan.value,
      get_max_pan_px: () => max_pan_px.value
    })
    ;({
      pan_offset,
      panning,
      was_pan_gesture,
      unregister: pan_unregister
    } = delegated)
  } else {
    pan_offset = ref(0)
    panning = ref(false)
  }

  const {
    held_layer,
    handle_pointerdown: on_pointerdown,
    handle_pointermove: on_pointermove,
    handle_pointerup: on_pointerup,
    handle_pointerleave: on_pointerleave,
    handle_contextmenu: on_touch_contextmenu
  } = use_poster_svg_activate_pointer({
    on_activate: on_click,
    touch_uses_long_press: () => props.touch_uses_long_press,
    is_disabled: () => mask_pen_active.value || props.behind_canvas,
    was_pan_gesture,
    on_non_touch_pointerdown: event => {
      held_layer.value = layer_from_target(event.target)
    }
  })

  /**
   * Touch callout is blocked either way; the mouse menu is blocked only while
   * the 3D canvas owns this poster, matching as-viewer-3d.
   * @param {Event} event
   */
  const on_contextmenu = event => {
    if (props.behind_canvas) event.preventDefault()
    else on_touch_contextmenu(event)
  }

  /**
   * Screen pixels per viewBox unit. A transform on an SVG element is in user
   * units, so a pan measured in screen pixels has to be converted or the two
   * axes of the same translate move at different rates.
   */
  const user_units = computed(() => {
    const rect = measured_frame.value
    if (!vector.value || !rect.width || !rect.height) return 1
    const [, , content_width, content_height] = vector.value.viewbox
      .split(' ')
      .map(Number)
    if (!content_width || !content_height) return 1
    return Math.max(rect.width / content_width, rect.height / content_height)
  })

  const pan_style = computed(() => {
    const across = can_pan.value ? pan_offset.value / user_units.value : 0
    const down = -camera_offset.value
    if (!across && !down) return {}
    const transform = `translate(${across}px, ${down}px)`
    const transition = panning.value
      ? 'none'
      : 'transform var(--duration-camera) var(--ease-camera)'
    return { transform, transition }
  })

  // Static baseline: cutouts blend with the shadow resting underneath.
  const CUTOUT_REST_OPACITY = 0.5
  // While morph runs, cutouts carry the poster where only the background
  // rect is underneath; wherever shadow geometry actually sits, the shared
  // luminance mask (as-masks.vue's cutout-shadow-dim) dims them back to
  // ~0.5 so the moving shadow reads through. Per-pixel, no clock.
  const CUTOUT_MORPH_OPACITY = 0.7
  // Nothing resting underneath, so the cutouts carry the poster alone. Not
  // full strength - they are still a mosaic, and 1 reads as flat.
  const CUTOUT_SOLO_OPACITY = 0.8
  // Strokes but no fills: less underneath than a full shadow, more than
  // nothing, so the cutouts sit between the two.
  const CUTOUT_STROKE_OPACITY = 0.65
  const OPACITY_FULL = 1
  const OPACITY_HIDDEN = 0

  /**
   * Real morph gate from as-animation (wind-down included). Reads the actual
   * `morph_active` state rather than re-deriving the preferences, so cutouts
   * stay raised and masked during the whole morph - including its wind-down
   * settle - and rest the instant it is genuinely done, instead of popping
   * early the moment a preference flips.
   */
  const morphing = computed(() => Boolean(as_animation.value?.morph_active))

  /** Surface the real morph-gate state (as-animation's `morph_active`, wind-down included) */
  const as_animation = ref(null)

  const layer_preferences = {
    boulders,
    rocks,
    gravel,
    sand,
    sediment
  }

  const layer_data = computed(() => {
    const layers = {}
    geology_layers.forEach(layer => {
      const pref = layer_preferences[layer]
      const wanted = Boolean(
        cutouts_enabled.value && pref.value && vector.value?.cutouts?.[layer]
      )
      const layer_id = props.itemid
        ? as_layer_id(/** @type {import('@/types').Id} */ (props.itemid), layer)
        : ''
      // Not `wanted` alone: the symbol this points at loads from idb, and a
      // `use` that mounts first fades up over geometry that is not there yet -
      // the layer then arrives partway through its own entrance, as far
      // through as the read was slow. Waiting puts both on one clock.
      const visible = wanted && is_symbol_ready(layer_id)
      const fragment = layer_id
        ? as_fragment_id(/** @type {import('@/types').Id} */ (layer_id))
        : ''
      let opacity = CUTOUT_SOLO_OPACITY
      if (stroke_only.value) opacity = CUTOUT_STROKE_OPACITY
      if (shadow_fill_displayed.value)
        opacity = morphing.value ? CUTOUT_MORPH_OPACITY : CUTOUT_REST_OPACITY
      // Opacity goes through a custom property, not an inline opacity: an
      // inline value outranks @starting-style, so the layer would pop in at
      // full strength instead of fading up.
      const style = visible
        ? { '--layer-opacity': opacity, visibility: 'visible' }
        : { '--layer-opacity': OPACITY_HIDDEN, visibility: 'hidden' }

      layers[layer] = { visible, wanted, fragment, style }
    })
    return layers
  })

  const visible_layers = computed(() =>
    geology_layers.filter(layer => layer_data.value[layer].visible)
  )

  /**
   * What the preferences asked for, whether or not it has drawn yet. The
   * build-up below is a reading of the press, so it follows the ask - the
   * symbols resolve one at a time, and keying it to those would call every
   * group change a single change.
   */
  const wanted_layers = computed(() =>
    geology_layers.filter(layer => layer_data.value[layer].wanted)
  )

  /**
   * Whether a build-up is running.
   *
   * The stagger reads as a build-up only when the group moves - the mosaic
   * switch. Held in the stylesheet it applied to every change, so a single
   * layer key waited its sibling's turn, four steps for boulders, and the
   * press read as unmapped.
   *
   * It is a window rather than a verdict on one change, because switching the
   * group on sends as-figure off to load the cutouts and `vector.cutouts`
   * fills in a layer at a time. Read change by change, a group entrance looks
   * like five separate single presses and stops staggering - which is exactly
   * how the build-up went missing. The switch opens the window; every layer
   * arriving inside it belongs to the same build-up.
   */
  const staggering = ref(false)
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let build_up

  const begin_build_up = () => {
    staggering.value = true
    clearTimeout(build_up)
    build_up = setTimeout(
      () => {
        staggering.value = false
      },
      duration_of('--duration-subject') +
        duration_of('--stagger-step') * (geology_layers.length - 1)
    )
  }

  unmounted(() => clearTimeout(build_up))

  watch(cutouts_enabled, begin_build_up)
  watch(wanted_layers, (now, before = []) => {
    const changed = geology_layers.filter(
      layer => now.includes(layer) !== before.includes(layer)
    )
    if (changed.length > 1) begin_build_up()
  })

  /** Where each layer sits in the build-up, as a transition delay. */
  const layer_delays = computed(() => {
    /** @type {Record<string, string>} */
    const delays = {}
    for (const layer of geology_layers)
      delays[layer] = staggering.value
        ? `calc(var(--stagger-step) * ${geology_layers.indexOf(layer)})`
        : '0s'
    return delays
  })

  // A layer turned off used to vanish on the same frame, which is why the
  // exit transition below never ran. It still unmounts - five masked `use`
  // elements measured ~29fps against ~59 - just one transition later. Only a
  // staggered exit waits on the build-up; a single layer leaves on its own
  // clock rather than sitting mounted through four steps it never took.
  const { keys: held_layers } = use_deferred_unmount(
    () => visible_layers.value,
    { steps: () => (staggering.value ? geology_layers.length - 1 : 0) }
  )

  /**
   * One mask on the cutout group, not per `<use>` - five masked uses cost
   * half the frame rate while morph runs (measured ~29 vs ~59 fps); the
   * group composites the mask once and keeps the full rate.
   */
  const cutout_group_mask = computed(() =>
    shadow_layer_displayed.value && morphing.value
      ? `url(${as_fragment_id(/** @type {import('@/types').Id} */ (props.itemid))}-cutout-shadow-dim)`
      : undefined
  )

  const shadow_fragment = computed(() => {
    if (!props.itemid) return ''
    const layer_id = as_layer_id(
      /** @type {import('@/types').Id} */ (props.itemid),
      'shadows'
    )
    return as_fragment_id(/** @type {import('@/types').Id} */ (layer_id))
  })

  const lightbar_back_style = computed(() => {
    if (!drama_back_visible.value)
      return { opacity: OPACITY_HIDDEN, visibility: 'hidden' }
    return { opacity: OPACITY_FULL, visibility: 'visible' }
  })

  const lightbar_front_style = computed(() => {
    if (!drama_front_visible.value)
      return { opacity: OPACITY_HIDDEN, visibility: 'hidden' }
    return { opacity: OPACITY_FULL, visibility: 'visible' }
  })

  unmounted(() => {
    on_pointerleave()
    document.removeEventListener(
      POSTER_MEET_TOGGLE_ONLY,
      on_meet_toggle_only_doc
    )
    vector.value = null
    if (pan_unregister) pan_unregister()
  })
</script>

<template>
  <svg
    ref="trigger"
    :id="query()"
    itemscope
    itemtype="https://realness.online/posters"
    :itemid="itemid"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    role="img"
    aria-roledescription="poster"
    :aria-label="poster_label"
    :tabindex="tabindex"
    :data-animate="animate || undefined"
    :data-hide-cursor="hide_cursor || undefined"
    :data-mask-pen-mode="mask_pen_active || undefined"
    :data-orientation="landscape ? 'horizontal' : 'vertical'"
    :data-held-layer="held_layer || undefined"
    :data-storytelling="storytelling || undefined"
    :data-aspect="
      poster_slice && aspect_ratio_mode !== 'auto'
        ? aspect_ratio_mode
        : undefined
    "
    @pointerdown="on_pointerdown"
    @pointermove="on_pointermove"
    @pointerup="on_pointerup"
    @pointerleave="on_pointerleave"
    @pointercancel="on_pointerleave"
    @contextmenu="on_contextmenu"
    @selectstart.prevent>
    <g :style="pan_style">
      <use itemprop="shadow" :href="shadow_fragment" />
      <rect
        id="lightbar-back"
        fill="url(#lightbar)"
        x="-11%"
        y="0"
        width="200%"
        height="200%"
        :style="lightbar_back_style" />

      <slot>
        <g v-if="cutouts_held" :mask="cutout_group_mask">
          <use
            v-for="layer in held_layers"
            :key="layer"
            :itemprop="layer"
            :href="layer_data[layer].fragment"
            :style="[
              layer_data[layer].style,
              { '--layer-delay': layer_delays[layer] }
            ]" />
        </g>
      </slot>

      <rect
        id="lightbar-front"
        fill="url(#lightbar)"
        x="-61%"
        y="0"
        width="200%"
        height="200%"
        :style="lightbar_front_style" />
      <as-mask-pen v-if="mask_pen_active && cutouts_mounted" :itemid="itemid" />
      <g
        data-grid-overlay
        :data-grid-visible="grid_visible ? 'true' : 'false'"
        pointer-events="none"
        :transform="`translate(${viewbox_rect.x} ${viewbox_rect.y})`">
        <line
          x1="0"
          :y1="viewbox_rect.height / 3"
          :x2="viewbox_rect.width"
          :y2="viewbox_rect.height / 3" />
        <line
          x1="0"
          :y1="(viewbox_rect.height * 2) / 3"
          :x2="viewbox_rect.width"
          :y2="(viewbox_rect.height * 2) / 3" />
        <line
          :x1="viewbox_rect.width / 3"
          y1="0"
          :x2="viewbox_rect.width / 3"
          :y2="viewbox_rect.height" />
        <line
          :x1="(viewbox_rect.width * 2) / 3"
          y1="0"
          :x2="(viewbox_rect.width * 2) / 3"
          :y2="viewbox_rect.height" />
      </g>
    </g>
    <defs>
      <as-gradients v-if="valid_vector" :vector="valid_vector" />
      <as-masks :itemid="itemid" />
    </defs>
    <as-animation
      ref="as_animation"
      v-if="vector && trigger"
      :svg="trigger"
      :id="itemid"
      :vector="vector"
      :in_view="in_view"
      :paused="paused || as_avatar" />
  </svg>
</template>

<style lang="stylus">
  @keyframes cutout-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 0.5;
    }
  }

  /* aspect-ratio: 2.76 / 1 // also film  28 years later used*/
  /* aspect-ratio: 2.35 / 1 // current film */
  /* aspect-ratio: 1.618 / 1 // golden-ratio */
  /* aspect-ratio: 16 / 9 // most like human vision */
  /* aspect-ratio: 4 / 3 // classic print */
  /* aspect-ratio: 1 / 1 // square */
  svg[itemtype$='/posters'] {
    display: block;
    min-height: 512px;
    height: 100%;
    width: 100%;
    overflow: hidden;
    cursor: pointer;
    disable-ios-touch-callout();
    // `pan-y` leaves the horizontal axis to our swipe handler while the page
    // keeps its vertical scroll; `pinch-zoom` hands two-finger zoom back to
    // the browser, which the pan-y alone had taken away.
    touch-action: pan-y pinch-zoom;
    contain: layout;
    &[data-storytelling] {
      // Storytelling scrolls the deck horizontally, so let touch swipes pan
      // the axis the poster actually scrolls on instead of eating the gesture.
      touch-action: pan-x pinch-zoom;
    }
    border-radius: calc(var(--base-line) * 0.03);
    transition:
      transform 0.4s ease-in-out,
      aspect-ratio 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      min-height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    max-height: 100%;
    &[data-aspect] {
      height: auto;
      min-height: 0;
      max-height: 100%;
    }
    &[data-hide-cursor] {
      cursor: none;
    }
    &[data-mask-pen-mode] {
      cursor: crosshair;
      // Allow the browser's native pinch-zoom (so masking can be precise on a phone)
      // while keeping one-finger drags for painting — `pinch-zoom` disables one-finger
      // pan, so the browser won't steal a paint stroke to scroll.
      touch-action: pinch-zoom;
      & use[itemprop='sediment'],
      & use[itemprop='sand'],
      & use[itemprop='gravel'],
      & use[itemprop='rocks'],
      & use[itemprop='boulders'] {
        pointer-events: none;
      }
    }

    & rect#lightbar-back,
    & rect#lightbar-front,
    & > rect:first-of-type,
    & symbol path[itemprop],
    & symbol rect[itemprop='background'] {
      pointer-events: none;
      transition:
        opacity duration-quick ease-exit,
        visibility duration-quick ease-exit;
    }
    & use[itemprop='sediment'],
    & use[itemprop='sand'],
    & use[itemprop='gravel'],
    & use[itemprop='rocks'],
    & use[itemprop='boulders'] {
      opacity: unquote('var(--layer-opacity, 0.5)');
      // visibility is in the list on purpose: layer_data hides a leaving layer
      // with visibility: hidden, and without a duration that applies on the
      // first frame and the opacity fade is never seen.
      transition:
        filter duration-subject ease-settle,
        opacity duration-subject ease-exit,
        visibility duration-subject ease-exit,
        display duration-subject ease-exit;
      transition-behavior: allow-discrete;
      // The mosaic switch turns all five layers on at once, and staggering
      // fine to coarse makes the build-up legible instead of one pop. The step
      // comes from the component, which is the only place that knows whether
      // the group moved together or one key answered for itself. Delay is per
      // property so the first one, filter, keeps hover instant.
      stagger(unquote('var(--layer-delay, 0s)'));

      &:hover {
        transition: filter 0.33s ease;
        filter: saturate(113%) brightness(108%);
      }
      &:active {
        filter: saturate(166%) brightness(130%);
      }
      &:focus {
        filter: saturate(150%) brightness(118%);
      }
    }


    &[data-held-layer='sediment'] use[itemprop='sediment'],
    &[data-held-layer='sand'] use[itemprop='sand'],
    &[data-held-layer='gravel'] use[itemprop='gravel'],
    &[data-held-layer='rocks'] use[itemprop='rocks'],
    &[data-held-layer='boulders'] use[itemprop='boulders'] {
      filter: saturate(166%) brightness(130%);
    }

    &[data-held-layer='shadow'] use[itemprop='shadow'] {
      opacity: 0.85;
    }

    // Four lines, so the overlay stays mounted and display carries it out.
    & g[data-grid-overlay] {
      opacity: 1;
      discrete-exit(duration-reveal);
      &[data-grid-visible='false'] {
        display: none;
        opacity: 0;
      }
    }

    & g[data-grid-overlay] line {
      fill: none;
      stroke: unquote('color-mix(in srgb, var(--bone) 72%, transparent)');
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      shape-rendering: crispEdges;
      paint-order: stroke;
    }

    // Reduced motion is handled once, in motion.css, by collapsing the
    // duration constants these transitions are written on.
  }

  @starting-style {
    svg[itemtype$='/posters'] rect#lightbar-back,
    svg[itemtype$='/posters'] rect#lightbar-front,
    svg[itemtype$='/posters'] > rect:first-of-type,
    svg[itemtype$='/posters'] symbol path[itemprop],
    svg[itemtype$='/posters'] symbol rect[itemprop='background'] {
      opacity: 0;
    }
  }

  @starting-style {
    svg[itemtype$='/posters'] use[itemprop='sediment'],
    svg[itemtype$='/posters'] use[itemprop='sand'],
    svg[itemtype$='/posters'] use[itemprop='gravel'],
    svg[itemtype$='/posters'] use[itemprop='rocks'],
    svg[itemtype$='/posters'] use[itemprop='boulders'] {
      opacity: 0;
    }
  }
</style>
