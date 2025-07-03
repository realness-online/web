<script setup>
  import Icon from '@/components/icon'
  import AsPath from '@/components/posters/as-path'
  import AsMasks from '@/components/posters/as-masks'
  import AsBackground from '@/components/posters/as-background'
  import AsGradients from '@/components/posters/as-gradients'
  import AsAnimation from '@/components/posters/as-animation'
  import AsTrace from '@/components/posters/as-trace'
  import {
    useIntersectionObserver as use_intersect,
    useStorage as use_storage,
    usePointer as use_pointer
  } from '@vueuse/core'
  import {
    watchEffect as watch_effect,
    onMounted as mounted,
    ref,
    inject,
    computed,
    nextTick as tick
  } from 'vue'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use as use_optimizer } from '@/use/optimize'
  import {
    use as use_poster,
    is_vector,
    is_vector_id,
    is_click,
    is_focus
  } from '@/use/poster'
  import {
    animate as animate_pref,
    light as light_pref,
    cutout as cutout_pref
  } from '@/utils/preference'
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
    optimize: {
      type: Boolean,
      required: false,
      default: false
    },
    toggle_aspect: {
      type: Boolean,
      required: false,
      default: true
    },
    slice: {
      type: Boolean,
      required: false,
      default: true
    },
    tabable: {
      type: Boolean,
      required: false,
      default: false
    },
    as_stroke: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const emit = defineEmits({
    focus: is_focus,
    click: is_click,
    show: is_vector
  })
  const {
    query,
    fragment,
    viewbox,
    aspect_ratio,
    click,
    working,
    show,
    focus,
    focusable,
    tabindex,
    vector,
    vector_element,
    intersecting
  } = use_poster()
  const { new_cutouts } = use_vectorize()
  const trigger = ref(null)
  const animate = computed(
    () => {
      const result = animate_pref.value === true && intersecting.value
      console.log('animate computed:', {
        animate_pref: animate_pref.value,
        intersecting: intersecting.value,
        result: result
      })
      return result
    }
  )
  const light = computed(() => light_pref.value === true && intersecting.value)
  const cutouts = computed(() => cutout_pref.value === true && intersecting.value)
  const mask = computed(() => intersecting.value)
  const landscape = computed(() => {
    if (!vector.value) return false
    const numbers = vector.value.viewbox.split(' ')
    const width = parseInt(numbers[2])
    const height = parseInt(numbers[3])
    return width > height
  })
  const { optimize: run_optimize } = use_optimizer(vector)
  const new_poster = inject('new-poster', false)
  if (new_poster) {
    const { new_vector, new_cutouts } = use_vectorize()
    vector.value = new_vector.value
    working.value = false
    const cutout_paths = new_cutouts.value.map(cutout => {
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      path.setAttribute('d', cutout.d)
      path.setAttribute(
        'fill',
        `rgb(${cutout.color.r}, ${cutout.color.g}, ${cutout.color.b})`
      )
      path.setAttribute('fill-opacity', '0.5')
      path.setAttribute(
        'transform',
        `translate(${cutout.offset.x}, ${cutout.offset.y})`
      )
      path.setAttribute('itemprop', 'cutouts')
      return path
    })
    new_cutouts.value = cutout_paths
  }

  mounted(() => {
    console.log('mounted - working:', working.value, 'sync_poster:', !!props.sync_poster, 'new_poster:', new_poster)
    if (!props.sync_poster && !new_poster) {
      console.log('Setting up intersection observer on trigger')
      use_intersect(
        trigger,
        ([{ isIntersecting }]) => {
          console.log('Intersection observer fired:', isIntersecting)
          if (isIntersecting) show()
        },
        { rootMargin: '1024px' }
      )
    } else {
      console.log('Skipping intersection observer setup')
    }
  })

  watch_effect(() => {
    if (props.sync_poster) {
      vector.value = props.sync_poster
      working.value = false
      emit('show', vector.value)
    }
  })
  watch_effect(async () => {
    if (vector.value && props.optimize && !vector.value.optimized) {
      await tick()
      await run_optimize()
    }
  })

  // Add pan and zoom state with storage
  const is_hovered = ref(false)

  // Store viewBox transforms in localStorage
  const storage_key = computed(() => `viewbox-${props.itemid}`)
  const viewbox_transform = use_storage(storage_key, {
    x: 0,
    y: 0,
    scale: 1
  })

  // Pointer tracking for hover and gestures
  const { x, y, pressure } = use_pointer({ target: vector_element })

  // Original viewBox values
  const original_viewbox = computed(() => {
    if (!vector.value) return { x: 0, y: 0, width: 16, height: 16 }
    const [x, y, width, height] = vector.value.viewbox.split(' ').map(Number)
    return { x, y, width, height }
  })

  // Computed viewBox with transforms
  const dynamic_viewbox = computed(() => {
    const { x, y, width, height } = original_viewbox.value
    const { x: dx, y: dy, scale } = viewbox_transform.value

    const new_width = width / scale
    const new_height = height / scale
    const new_x = x + dx / scale
    const new_y = y + dy / scale

    return `${new_x} ${new_y} ${new_width} ${new_height}`
  })

  // Gesture handling
  let is_dragging = false
  let start_x = 0
  let start_y = 0
  let start_transform = null

  const handle_pointer_down = event => {
    is_dragging = true
    start_x = event.clientX
    start_y = event.clientY
    start_transform = { ...viewbox_transform.value }
    is_hovered.value = true
  }

  const handle_pointer_move = event => {
    if (!is_dragging) return

    const delta_x = event.clientX - start_x
    const delta_y = event.clientY - start_y

    viewbox_transform.value = {
      ...start_transform,
      x: start_transform.x + delta_x,
      y: start_transform.y + delta_y
    }
  }

  const handle_pointer_up = () => {
    is_dragging = false
    is_hovered.value = false
  }

  const handle_wheel = event => {
    console.log('handle_wheel', event)
    // // Always handle wheel events for viewBox control
    // event.preventDefault()

    // if (event.shiftKey && event.metaKey) {
    //   // Shift + Command + wheel = zoom in/out centered on viewport
    //   const delta = event.deltaY > 0 ? 1.1 : 0.9
    //   const new_scale = Math.max(
    //     0.5,
    //     Math.min(3, viewbox_transform.value.scale * delta)
    //   )

    //   // Calculate zoom center (middle of current viewport)
    //   const svg_rect = vector_element.value.getBoundingClientRect()
    //   const center_x = svg_rect.width / 2
    //   const center_y = svg_rect.height / 2

    //   // Convert screen coordinates to viewBox coordinates
    //   const current_viewbox = dynamic_viewbox.value.split(' ').map(Number)
    //   const viewbox_width = current_viewbox[2]
    //   const viewbox_height = current_viewbox[3]

    //   const scale_ratio = new_scale / viewbox_transform.value.scale
    //   const zoom_center_x = (center_x / svg_rect.width) * viewbox_width
    //   const zoom_center_y = (center_y / svg_rect.height) * viewbox_height

    //   // Adjust position to keep zoom center fixed
    //   const new_x =
    //     viewbox_transform.value.x + zoom_center_x * (1 - scale_ratio)
    //   const new_y =
    //     viewbox_transform.value.y + zoom_center_y * (1 - scale_ratio)

    //   viewbox_transform.value = {
    //     x: new_x,
    //     y: new_y,
    //     scale: new_scale
    //   }
    // } else if (event.shiftKey) {
    //   // Shift + wheel = horizontal panning (left/right)
    //   // Use deltaX for horizontal scrolling when shift is held
    //   const delta_x = event.deltaX || event.deltaY
    //   const pan_amount = delta_x > 0 ? -20 : 20
    //   viewbox_transform.value = {
    //     ...viewbox_transform.value,
    //     x: viewbox_transform.value.x + pan_amount
    //   }
    // } else {
    //   // Regular wheel = vertical panning (up/down)
    //   const delta_y = event.deltaY > 0 ? 20 : -20
    //   viewbox_transform.value = {
    //     ...viewbox_transform.value,
    //     y: viewbox_transform.value.y + delta_y
    //   }
    // }
  }

  // Reset viewBox on double tap
  const reset_viewbox = () => {
    viewbox_transform.value = { x: 0, y: 0, scale: 1 }
  }

  // // Touch gesture handling
  // let touch_start_distance = 0
  // let touch_start_scale = 1

  const get_touch_distance = touches => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handle_touch_start = event => {
    console.log('handle_touch_start', event.touches)
    // event.preventDefault()
    // if (event.touches.length === 2) {
    //   touch_start_distance = get_touch_distance(event.touches)
    //   touch_start_scale = viewbox_transform.value.scale
    // } else if (event.touches.length === 1) {
    //   handle_pointer_down(event.touches[0])
    // }
  }

  const handle_touch_move = event => {
    console.log('handle_touch_move', event.touches)
    // event.preventDefault()
    // if (event.touches.length === 2) {
    //   const current_distance = get_touch_distance(event.touches)
    //   if (touch_start_distance > 0) {
    //     const scale_factor = current_distance / touch_start_distance
    //     const new_scale = Math.max(
    //       0.5,
    //       Math.min(3, touch_start_scale * scale_factor)
    //     )
    //     viewbox_transform.value = {
    //       ...viewbox_transform.value,
    //       scale: new_scale
    //     }
    //   }
    // } else if (event.touches.length === 1) {
    //   handle_pointer_move(event.touches[0])
    // }
  }

  const handle_touch_end = event => {
    console.log('handle_touch_end', event.touches)
    //   event.preventDefault()
    //   if (event.touches.length === 0) {
    //     handle_pointer_up()
    // }
  }

  const hovered_cutout = ref(null)
  const handle_cutout_touch_start = (event, index) => {
    event.preventDefault()
    hovered_cutout.value = index
  }
  const handle_cutout_touch_end = event => {
    event.preventDefault()
    hovered_cutout.value = null
  }

</script>

<template>
  <icon v-if="working" ref="trigger" name="working" :tabindex="focusable" />
  <svg
    v-else
    ref="vector_element"
    :id="query()"
    itemscope
    itemtype="/posters"
    :itemid="itemid"
    :viewBox="dynamic_viewbox"
    :preserveAspectRatio="aspect_ratio"
    :tabindex="focusable"
    :class="{ animate, landscape, hovered: is_hovered }"
    @click="click"
    @dblclick="reset_viewbox"
    @wheel="handle_wheel"
    @touchstart="handle_touch_start"
    @touchmove="handle_touch_move"
    @touchend="handle_touch_end">
    <defs class="graphic">
      <pattern
        :id="query('overlay')"
        :width="vector.width"
        :height="vector.height"
        :viewBox="viewbox"
        patternUnits="userSpaceOnUse"
        :preserveAspectRatio="aspect_ratio">
        <as-background
          :id="query('background')"
          :rect="vector.background"
          :width="vector.width"
          :height="vector.height"
          :tabindex="tabindex"
          fill-opacity="1"
          :fill="`url(${fragment('radial-background')})`"
          @focus="focus('background')" />
        <as-trace
          v-if="vector.trace"
          :trace="vector.trace"
          :itemid="itemid"
          :tabindex="tabindex"
          @focus="focus('trace')" />
        <as-path
          v-if="vector.light"
          :id="query('light')"
          itemprop="light"
          :path="vector.light"
          :tabindex="tabindex"
          :mask="`url(${fragment('horizontal-mask')})`"
          :fill="`url(${fragment('vertical-light')})`"
          :stroke="`url(${fragment('horizontal-medium')})`"
          stroke-dasharray="8,16"
          @focus="focus('light')" />
        <as-path
          v-if="vector.regular"
          :id="query('regular')"
          itemprop="regular"
          :path="vector.regular"
          :tabindex="tabindex"
          :mask="`url(${fragment('radial-mask')})`"
          :fill="`url(${fragment('horizontal-regular')})`"
          :stroke="`url(${fragment('radial-medium')})`"
          stroke-dasharray="13,21"
          @focus="focus('regular')" />
        <as-path
          v-if="vector.medium"
          :id="query('medium')"
          itemprop="medium"
          :path="vector.medium"
          :tabindex="tabindex"
          :mask="`url(${fragment('vertical-mask')})`"
          :fill="`url(${fragment('vertical-medium')})`"
          :stroke="`url(${fragment('vertical-light')})`"
          stroke-dasharray="18,26"
          @focus="focus('medium')" />
        <as-path
          v-if="vector.bold"
          :id="query('bold')"
          itemprop="bold"
          :tabindex="tabindex"
          :path="vector.bold"
          :mask="`url(${fragment('horizontal-mask')})`"
          :fill="`url(${fragment('vertical-bold')})`"
          :stroke="`url(${fragment('radial-regular')})`"
          stroke-dasharray="24,32"
          @focus="focus('bold')" />
      </pattern>
      <pattern
        :id="query('cutout')"
        :width="vector.width"
        :height="vector.height"
        :viewBox="viewbox"
        patternUnits="userSpaceOnUse"
        :preserveAspectRatio="aspect_ratio">
        <path
          v-for="(path, index) in vector.cutout"
          :key="`cutout-${index}`"
          :d="path.d"
          itemprop="cutout"
          :fill="`rgb(${path.color.r}, ${path.color.g}, ${path.color.b})`"
          fill-opacity="0.5"
          :class="{ hovered: hovered_cutout === index }"
          @touchstart="event => handle_cutout_touch_start(event, index)"
          @touchend="handle_cutout_touch_end" />
      </pattern>
      <rect
        :id="query('pattern-render')"
        :fill="`url(${fragment('pattern')})`"
        width="100%"
        height="100%" />
    </defs>
    <as-gradients v-if="vector" :vector="vector" />
    <as-masks v-if="mask" :itemid="itemid" />
    <use :href="fragment('pattern')" />
    <g>
      <use :href="fragment('background')" @focus="focus('bold')" />
      <use :href="fragment('light')" @focus="focus('light')" />
      <use :href="fragment('regular')" @focus="focus('regular')" />
      <use :href="fragment('medium')" @focus="focus('medium')" />
      <use :href="fragment('bold')" @focus="focus('bold')" />
    </g>
    <g id="cutouts" v-if="cutout">
      <path
        v-if="new_poster"
        v-for="(path, index) in new_cutouts"
        :key="`new-path-${index}`"
        :d="path.d"
        itemprop="cutout"
        :fill="`rgb(${path.color.r}, ${path.color.g}, ${path.color.b})`"
        fill-opacity="0.5"
        :transform="`translate(${path.offset.x}, ${path.offset.y})`"
        :class="{ hovered: hovered_cutout === index }"
        @touchstart="event => handle_cutout_touch_start(event, index)"
        @touchend="handle_cutout_touch_end" />
    </g>
    <rect
      v-if="light"
      id="lightbar-rect"
      fill="url(#lightbar)"
      width="100%"
      height="100%" />
    <as-animation v-if="animate" :id="vector.id" />
  </svg>
</template>

<style>
  /* aspect-ratio: 1.618 / 1 // golden-ratio */
  /* aspect-ratio: 2.35 / 1 // current film */
  /* aspect-ratio: 16 / 9 // most like human vision */
  /* aspect-ratio: 1 / 1 // square */
  svg[itemtype='/posters'] {
    display: block;
    min-height: 512px;
    height: 100%;
    width: 100%;
    outline: none;
    cursor: grab;
    transition: all 0.3s ease;
    -webkit-tap-highlight-color: transparent;
    /* touch-action: none; Prevent browser gestures */

    /* Active state for touch */
    &:active {
      cursor: grabbing;
    }

    filter: brightness(1.1);
    transition: filter 0.3s ease;

    /* Hover effects on individual cutout path elements (mouse and touch) */
    path[itemprop='cutouts']:hover,
    path[itemprop='cutouts'].hovered {
      filter: brightness(1.25);
      transition: filter 0.3s ease;
    }

    path[itemprop='cutouts'] {
      transition: filter 0.3s ease 0.1s; /* Delay on hover out */
    }

    /* Animation effects for cutouts */
    path[itemprop='cutouts'].animated {
      filter: brightness(1.4) saturate(1.2);
      transition: all 0.5s ease;
      transform-origin: center;
      animation: cutout-pulse 1s ease-in-out infinite alternate;
    }

    use:focus {
      outline: none;
    }

    & rect.emboss {
      pointer-events: none;
      user-select: none;
    }
  }
</style>
