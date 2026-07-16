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
    computed,
    provide,
    inject
  } from 'vue'
  import { useDocumentVisibility, useMediaQuery } from '@vueuse/core'
  import {
    use as use_poster,
    is_vector,
    is_vector_id,
    geology_layers
  } from '@/use/poster'
  import {
    animate as animate_pref,
    drama_back,
    drama_front,
    shadow,
    stroke,
    mosaic,
    boulders,
    rocks,
    gravel,
    sand,
    sediment,
    storytelling,
    aspect_ratio_mode,
    slice_alignment,
    grid
  } from '@/utils/preference'
  import { as_layer_id, as_fragment_id, as_created_at } from '@/utils/itemid'
  import { as_day } from '@/utils/date'
  import { POSTER_MEET_TOGGLE_ONLY } from '@/use/poster-dom-reference'
  import { use_poster_svg_activate_pointer } from '@/use/poster-svg-activate-pointer'
  import {
    poster_landscape,
    slice_preserve_aspect_ratio
  } from '@/use/poster-aspect'
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
    }
  })
  const emit = defineEmits(['focus', 'click', 'show', 'in_view'])
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
      emit('in_view', true)
      vector.value = props.sync_poster
      emit('show', vector.value)
    } else {
      use_intersect(trigger, ([{ isIntersecting }]) => {
        intersecting.value = isIntersecting
        emit('in_view', isIntersecting)
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
      emit('in_view', true)
      vector.value = props.sync_poster
      emit('show', vector.value)
    } else if (props.sync_poster === null) vector.value = null
  })

  const is_loading = computed(() => {
    if (!intersecting.value) return false
    if (working.value) return true
    if (!vector.value) return true
    if (!vector.value.regular) return true
    return false
  })
  const drama_back_visible = computed(
    () => drama_back.value || is_loading.value
  )
  const drama_front_visible = computed(
    () => drama_front.value || is_loading.value
  )

  const shadow_layer_displayed = computed(() => shadow.value || stroke.value)

  const viewbox_rect = computed(() => {
    const [x, y, width, height] = viewbox.value.split(' ').map(Number)
    return { x, y, width, height }
  })

  const grid_visible = computed(() => grid.value)

  const hide_cursor = computed(() => poster_slice.value && storytelling.value)

  const orientation_portrait = useMediaQuery('(orientation: portrait)')
  const can_pan = computed(
    () => orientation_portrait.value && !use_meet.value && !storytelling.value
  )
  const max_pan_px = computed(() => {
    if (!can_pan.value || !trigger.value || !vector.value) return 0
    const rect = trigger.value.getBoundingClientRect()
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
    handle_pointerleave: on_pointerleave
  } = use_poster_svg_activate_pointer({
    on_activate: on_click,
    touch_uses_long_press: () => props.touch_uses_long_press,
    is_disabled: () => mask_pen_active.value,
    was_pan_gesture,
    on_non_touch_pointerdown: event => {
      held_layer.value = layer_from_target(event.target)
    }
  })

  const pan_style = computed(() => {
    if (!can_pan.value) return {}
    const transform = `translateX(${pan_offset.value}px)`
    const transition = panning.value ? 'none' : 'transform 0.25s ease-out'
    return { transform, transition }
  })

  const OPACITY_HALF = 0.5
  const OPACITY_FULL = 1
  const OPACITY_HIDDEN = 0

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
      const visible =
        cutouts_enabled.value && pref.value && vector.value?.cutouts?.[layer]
      const fragment = props.itemid
        ? as_fragment_id(
            as_layer_id(
              /** @type {import('@/types').Id} */ (props.itemid),
              layer
            )
          )
        : ''
      const style = visible
        ? {
            opacity: shadow_layer_displayed.value ? OPACITY_HALF : OPACITY_FULL,
            visibility: 'visible'
          }
        : {
            opacity: OPACITY_HIDDEN,
            visibility: 'hidden'
          }

      layers[layer] = { visible, fragment, style }
    })
    return layers
  })

  const visible_layers = computed(() =>
    geology_layers.filter(layer => layer_data.value[layer].visible)
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
    itemtype="/posters"
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
    @contextmenu.prevent
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
        <g v-if="cutouts_mounted">
          <use
            v-for="layer in visible_layers"
            :key="layer"
            :itemprop="layer"
            :href="layer_data[layer].fragment"
            :style="layer_data[layer].style" />
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
        v-if="grid_visible"
        data-grid-overlay
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
      v-if="vector && trigger"
      :svg="trigger"
      :id="itemid"
      :paused="!animate" />
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
  /* aspect-ratio: 1 / 1 // square */
  svg[itemtype='/posters'] {
    display: block;
    min-height: 512px;
    height: 100%;
    width: 100%;
    overflow: hidden;
    cursor: pointer;
    disable-ios-touch-callout();
    touch-action: pan-y;
    contain: layout;
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
        opacity 0.2s ease,
        visibility 0.2s ease;
    }
    & use[itemprop='sediment'],
    & use[itemprop='sand'],
    & use[itemprop='gravel'],
    & use[itemprop='rocks'],
    & use[itemprop='boulders'] {
      opacity: 0.5;
      transition:
        filter 0.44s ease-in-out,
        opacity 0.44s ease-out,
        display 0.44s ease-out;
      transition-behavior: allow-discrete;

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

    & g[data-grid-overlay] line {
      fill: none;
      stroke: unquote('color-mix(in srgb, var(--bone) 72%, transparent)');
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      shape-rendering: crispEdges;
      paint-order: stroke;
    }

    @media (prefers-reduced-motion: reduce) {
      transition-duration: 0.01ms;
    }
  }

  @starting-style {
    svg[itemtype='/posters'] rect#lightbar-back,
    svg[itemtype='/posters'] rect#lightbar-front,
    svg[itemtype='/posters'] > rect:first-of-type,
    svg[itemtype='/posters'] symbol path[itemprop],
    svg[itemtype='/posters'] symbol rect[itemprop='background'] {
      opacity: 0;
    }
  }

  @starting-style {
    svg[itemtype='/posters'] use[itemprop='sediment'],
    svg[itemtype='/posters'] use[itemprop='sand'],
    svg[itemtype='/posters'] use[itemprop='gravel'],
    svg[itemtype='/posters'] use[itemprop='rocks'],
    svg[itemtype='/posters'] use[itemprop='boulders'] {
      opacity: 0;
    }
  }
</style>
