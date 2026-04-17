<script setup>
  import AsMasks from '@/components/posters/as-masks'
  import AsGradients from '@/components/posters/as-gradients'
  import AsAnimation from '@/components/posters/as-animation'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import {
    watchEffect as watch,
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
    slice_alignment
  } from '@/utils/preference'
  import { as_layer_id, as_fragment_id } from '@/utils/itemid'
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
    /** When set, overrides mosaic preference for cutout visibility. */
    show_cutout_layers: {
      type: Boolean,
      default: undefined
    },
    /**
     * When true (default), touch must press and hold to toggle meet / emit click.
     * Set false when the parent needs an immediate tap on touch (e.g. profile avatar).
     */
    touch_uses_long_press: {
      type: Boolean,
      default: true
    },
    /** Poster is shown as a profile / list avatar; SMIL must stay off regardless of animate preference. */
    as_avatar: {
      type: Boolean,
      default: false
    }
  })
  const emit = defineEmits(['focus', 'click', 'show', 'in_view'])
  const {
    query,
    show,
    focusable,
    vector,
    intersecting,
    is_hovered,
    viewbox,
    working
  } = use_poster()

  const poster_slice = computed(() => props.slice ?? false)
  const use_meet = ref(false)

  const cutouts_enabled = computed(() =>
    props.show_cutout_layers !== undefined
      ? props.show_cutout_layers
      : mosaic.value
  )

  const aspect_ratio = computed(() => {
    if (use_meet.value) return 'xMidYMid meet'
    const alignment = slice_alignment.value || 'ymid'
    let y_align = 'Mid'
    if (alignment === 'ymin') y_align = 'Min'
    else if (alignment === 'ymax') y_align = 'Max'
    return `xMidY${y_align} slice`
  })

  const cutouts_mounted = computed(
    () => intersecting.value && cutouts_enabled.value
  )

  const HOLD_MS = 250
  /** Long-press on touch toggles meet + menu; quick taps do not (avoids swipe confusion). */
  const TOUCH_TOGGLE_HOLD_MS = 450
  const MOVE_CANCEL_TOUCH_TOGGLE_PX = 8

  const held_layer = ref(null)
  let hold_timer = null
  let was_hold = false
  let cancelled = false

  let touch_toggle_timer = null
  let touch_toggle_fired = false
  let touch_start_x = 0
  let touch_start_y = 0

  /** @param {PointerEvent} event */
  const is_touch_pointer = event => event.pointerType === 'touch'

  const layer_from_target = el => {
    const use_el = el?.closest?.('use[itemprop]')
    if (!use_el) return null
    const prop = use_el.getAttribute('itemprop')
    if (prop === 'shadow' || geology_layers.includes(prop)) return prop
    return null
  }

  /** @param {PointerEvent} event */
  const handle_pointerdown = event => {
    was_hold = false
    cancelled = false
    if (hold_timer) clearTimeout(hold_timer)
    hold_timer = null
    if (touch_toggle_timer) {
      clearTimeout(touch_toggle_timer)
      touch_toggle_timer = null
    }
    touch_toggle_fired = false

    const layer = layer_from_target(event.target)

    if (is_touch_pointer(event) && props.touch_uses_long_press) {
      touch_start_x = event.clientX
      touch_start_y = event.clientY
      hold_timer = setTimeout(() => {
        hold_timer = null
        was_hold = true
        held_layer.value = layer
      }, HOLD_MS)
      touch_toggle_timer = setTimeout(() => {
        touch_toggle_timer = null
        if (cancelled) return
        touch_toggle_fired = true
        held_layer.value = null
        was_hold = false
        handle_click()
      }, TOUCH_TOGGLE_HOLD_MS)
      return
    }

    hold_timer = setTimeout(() => {
      hold_timer = null
      was_hold = true
      held_layer.value = layer
    }, HOLD_MS)
  }

  /** @param {PointerEvent} event */
  const handle_pointermove = event => {
    if (!is_touch_pointer(event) || !props.touch_uses_long_press) return
    if (!touch_toggle_timer && !hold_timer) return
    const dx = Math.abs(event.clientX - touch_start_x)
    const dy = Math.abs(event.clientY - touch_start_y)
    if (dx <= MOVE_CANCEL_TOUCH_TOGGLE_PX && dy <= MOVE_CANCEL_TOUCH_TOGGLE_PX)
      return
    cancelled = true
    if (touch_toggle_timer) {
      clearTimeout(touch_toggle_timer)
      touch_toggle_timer = null
    }
    if (hold_timer) {
      clearTimeout(hold_timer)
      hold_timer = null
    }
    held_layer.value = null
    was_hold = false
  }

  /** @param {PointerEvent} event */
  const handle_pointerup = event => {
    if (hold_timer) {
      clearTimeout(hold_timer)
      hold_timer = null
    }
    if (touch_toggle_timer) {
      clearTimeout(touch_toggle_timer)
      touch_toggle_timer = null
    }
    if (cancelled) return

    if (is_touch_pointer(event) && props.touch_uses_long_press) {
      if (was_pan_gesture?.value) {
        was_pan_gesture.value = false
        held_layer.value = null
        was_hold = false
        return
      }
      if (touch_toggle_fired) {
        touch_toggle_fired = false
        held_layer.value = null
        was_hold = false
        return
      }
      held_layer.value = null
      was_hold = false
      return
    }

    if (was_hold) {
      held_layer.value = null
      was_hold = false
      return
    }
    if (was_pan_gesture?.value) {
      was_pan_gesture.value = false
      return
    }
    handle_click()
  }

  const handle_pointerleave = () => {
    if (hold_timer) clearTimeout(hold_timer)
    hold_timer = null
    if (touch_toggle_timer) {
      clearTimeout(touch_toggle_timer)
      touch_toggle_timer = null
    }
    cancelled = true
    held_layer.value = null
  }

  const handle_click = () => {
    use_meet.value = !use_meet.value
    emit('click', true)
  }

  defineExpose({ toggle_meet: handle_click })

  const trigger = ref(null)
  const visibility = useDocumentVisibility()
  /** In-app `animate` preference only (default off). Not OS reduced-motion; users opt in explicitly. */
  const animate = computed(
    () =>
      animate_pref.value === true &&
      !props.as_avatar &&
      intersecting.value &&
      visibility.value === 'visible'
  )
  const landscape = computed(() => {
    if (!vector.value) return false
    const numbers = vector.value.viewbox.split(' ')
    const width = parseInt(numbers[2])
    const height = parseInt(numbers[3])
    return width > height
  })

  const valid_vector = computed(() => {
    if (!vector.value) return null
    if (is_vector(vector.value)) return vector.value
    return null
  })

  provide('vector', vector)

  mounted(async () => {
    if (!props.sync_poster)
      use_intersect(trigger, ([{ isIntersecting }]) => {
        intersecting.value = isIntersecting
        emit('in_view', isIntersecting)
        if (isIntersecting) show()
      })
    else {
      intersecting.value = true
      emit('in_view', true)
      vector.value = props.sync_poster
      emit('show', vector.value)
    }
    await tick()
  })

  watch(() => {
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

  const svg_style = computed(() => {
    if (poster_slice.value && aspect_ratio_mode.value !== 'auto')
      return { aspectRatio: aspect_ratio_mode.value }
    return {}
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
    :tabindex="focusable"
    :style="svg_style"
    :class="{
      animate,
      landscape,
      hovered: is_hovered,
      'hide-cursor': hide_cursor
    }"
    :data-held-layer="held_layer || undefined"
    :data-aspect="
      aspect_ratio_mode && aspect_ratio_mode !== 'auto'
        ? aspect_ratio_mode
        : undefined
    "
    @pointerdown="handle_pointerdown"
    @pointermove="handle_pointermove"
    @pointerup="handle_pointerup"
    @pointerleave="handle_pointerleave"
    @pointercancel="handle_pointerleave">
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
        <g v-if="cutouts_mounted" class="cutouts">
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
    </g>
    <defs>
      <symbol id="grid-overlay" viewBox="0 0 1 1">
        <rect width="1.00" height="0.33" />
        <rect width="1.00" height="0.33" y="0.33" rx="0.011" />
        <rect width="1.00" height="0.33" y="0.66" rx="0.011" />
        <rect width="0.33" height="0.33" y="0.33" x="0.33" rx="0.011" />
      </symbol>
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

<style>
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
    -webkit-tap-highlight-color: transparent;
    contain: layout;
    transition:
      transform 0.4s ease-in-out,
      aspect-ratio 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      min-height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    max-height: 100%;
    &[style*='aspect-ratio'] {
      height: auto;
      min-height: 0;
      max-height: 100%;
    }
    &.hide-cursor {
      cursor: none;
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
      @starting-style {
        opacity: 0;
      }
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

      @starting-style {
        opacity: 0;
      }

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

    /* Accessibility: no motion */
    @media (prefers-reduced-motion: reduce) {
      transition-duration: 0.01ms;
      & use[itemprop='sediment'],
      & use[itemprop='sand'],
      & use[itemprop='gravel'],
      & use[itemprop='rocks'],
      & use[itemprop='boulders'] {
        animation: none !important;
        opacity: 0.5;
      }
    }
  }
</style>
