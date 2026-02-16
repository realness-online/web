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
    provide
  } from 'vue'
  import { useMediaQuery } from '@vueuse/core'
  import {
    use as use_poster,
    is_vector,
    is_vector_id,
    is_click,
    is_focus,
    geology_layers
  } from '@/use/poster'
  import {
    animate as animate_pref,
    drama_back,
    drama_front,
    fill,
    stroke,
    cutout,
    boulders,
    rocks,
    gravel,
    sand,
    sediment,
    storytelling,
    aspect_ratio_mode
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
    }
  })
  const emit = defineEmits({
    focus: is_focus,
    click: is_click,
    show: is_vector
  })
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

  const aspect_ratio = computed(() =>
    use_meet.value ? 'xMidYMid meet' : 'xMidYMid slice'
  )

  const handle_click = () => {
    use_meet.value = !use_meet.value
    emit('click', true)
  }

  const trigger = ref(null)
  const animate = computed(
    () => animate_pref.value === true && intersecting.value
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
        if (isIntersecting) show()
      })
    else {
      intersecting.value = true
      vector.value = props.sync_poster
      emit('show', vector.value)
    }
    await tick()
    touch_target = trigger.value
    if (touch_target) {
      touch_target.addEventListener('touchstart', on_touch_start, {
        passive: true
      })
      touch_target.addEventListener('touchmove', on_touch_move, {
        passive: false
      })
      touch_target.addEventListener('touchend', on_touch_end, {
        passive: true
      })
    }
  })

  watch(() => {
    if (props.sync_poster) {
      intersecting.value = true
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

  const shadow_layer_displayed = computed(() => fill.value || stroke.value)

  const hide_cursor = computed(() => poster_slice.value && storytelling.value)

  const orientation_portrait = useMediaQuery('(orientation: portrait)')
  const can_pan = computed(
    () => orientation_portrait.value && !use_meet.value && !storytelling.value
  )
  const pan_offset = ref(0)
  const panning = ref(false)
  const touch_start_x = ref(0)
  const touch_start_y = ref(0)
  const pan_start_offset = ref(0)
  const gesture_is_pan = ref(false)
  const gesture_decided = ref(false)
  const RUBBER_RESISTANCE = 0.25
  const MAX_OVERFLOW_PX = 80
  const EDGE_ZONE_PX = 32
  const touch_in_edge_zone = ref(false)

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

  const pan_style = computed(() => {
    if (!can_pan.value) return {}
    const transform = `translateX(${pan_offset.value}px)`
    const transition = panning.value ? 'none' : 'transform 0.25s ease-out'
    return { transform, transition }
  })

  const GESTURE_THRESHOLD = 8

  const on_touch_start = event => {
    if (!can_pan.value || !event.touches.length) return
    panning.value = true
    const [touch] = event.touches
    touch_start_x.value = touch.clientX
    touch_start_y.value = touch.clientY
    touch_in_edge_zone.value = touch.clientX < EDGE_ZONE_PX
    pan_start_offset.value = pan_offset.value
    gesture_decided.value = false
    gesture_is_pan.value = false
  }

  const on_touch_move = event => {
    if (!can_pan.value || !event.touches.length) return
    const [touch] = event.touches
    const delta_x = touch.clientX - touch_start_x.value
    const delta_y = touch.clientY - touch_start_y.value
    if (!gesture_decided.value) {
      const abs_x = Math.abs(delta_x)
      const abs_y = Math.abs(delta_y)
      if (abs_x > GESTURE_THRESHOLD || abs_y > GESTURE_THRESHOLD) {
        gesture_decided.value = true
        gesture_is_pan.value = !touch_in_edge_zone.value && abs_x > abs_y
      }
    }
    if (!gesture_is_pan.value) return
    event.preventDefault()
    const raw = pan_start_offset.value + delta_x
    const max = max_pan_px.value
    let value
    if (raw > max) {
      const overflow = Math.min(
        (raw - max) * RUBBER_RESISTANCE,
        MAX_OVERFLOW_PX
      )
      value = max + overflow
    } else if (raw < -max) {
      const overflow = Math.min(
        (-max - raw) * RUBBER_RESISTANCE,
        MAX_OVERFLOW_PX
      )
      value = -max - overflow
    } else value = raw

    pan_offset.value = value
  }

  const on_touch_end = () => {
    panning.value = false
    if (gesture_is_pan.value) {
      const max = max_pan_px.value
      pan_offset.value = Math.max(-max, Math.min(max, pan_offset.value))
    }
    gesture_decided.value = false
    gesture_is_pan.value = false
  }

  let touch_target = null

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
        cutout.value && pref.value && vector.value?.cutouts?.[layer]
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
    if (touch_target) {
      touch_target.removeEventListener('touchstart', on_touch_start)
      touch_target.removeEventListener('touchmove', on_touch_move)
      touch_target.removeEventListener('touchend', on_touch_end)
    }
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
    @click="handle_click">
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
        <g v-if="intersecting" class="cutouts">
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
    <as-animation v-if="vector" :id="itemid" />
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
    transition: transform 0.5s ease-in-out;
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
      filter: saturate(100%) brightness(100%);
      will-change: opacity, filter, display;
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
        /* cursor: grabbing; */
        filter: saturate(166%) brightness(130%);
      }
      &:focus {
        filter: saturate(150%) brightness(118%);
      }
    }

    /* Accessibility: no motion */
    @media (prefers-reduced-motion: reduce) {
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
