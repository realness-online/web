<script setup>
  import Icon from '@/components/icon'
  import AsPath from '@/components/posters/as-path'
  import AsMasks from '@/components/posters/as-masks'
  import AsBackground from '@/components/posters/as-background'
  import AsGradients from '@/components/posters/as-gradients'
  import AsAnimation from '@/components/posters/as-animation'
  import {
    useIntersectionObserver as use_intersect
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
    cutout,
    background
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
    intersecting,
    is_hovered,
    dynamic_viewbox,
    wheel,
    reset,
    touch_start,
    touch_move,
    touch_end,
    cutout_start,
    cutout_end,
    hovered_cutout
  } = use_poster()

  const trigger = ref(null)
  const animate = computed(() => animate_pref.value === true && intersecting.value)
  const light = computed(() => light_pref.value === true && intersecting.value)
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
    const { new_vector } = use_vectorize()
    vector.value = new_vector.value
    working.value = false
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
    @dblclick="reset"
    @wheel="wheel"
    @touchstart="touch_start"
    @touchmove="touch_move"
    @touchend="touch_end">
    <pattern
      :id="query('foundation')"
      :width="vector.width"
      :height="vector.height"
      :viewBox="viewbox"
      patternUnits="userSpaceOnUse"
      :preserveAspectRatio="aspect_ratio">
      <as-background
        v-if="background"
        :id="query('background')"
        :rect="vector.background"
        :width="vector.width"
        :height="vector.height"
        :tabindex="tabindex"
        fill-opacity="1"
        :fill="`url(${fragment('radial-background')})`"
        @focus="focus('background')" />

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
        :stroke="`url(${fragment('vertical-background')})`"
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
      :id="query('cutouts')"
      :width="vector.width"
      :height="vector.height"
      :viewBox="viewbox"
      itemprop="cutouts"
      patternUnits="userSpaceOnUse"
      :preserveAspectRatio="aspect_ratio">
      <path
        v-for="(path, index) in vector.cutout"
        :key="`cutout-${index}`"
        :d="path.d"
        itemprop="progress"
        :fill="`rgb(${path.color.r}, ${path.color.g}, ${path.color.b})`"
        fill-opacity="0.5"
        :class="{ hovered: hovered_cutout === index }"
        @touchstart="event => cutout_start(event, index)"
        @touchend="cutout_end" />
    </pattern>
    <as-gradients v-if="vector" :vector="vector" />
    <as-masks v-if="mask" :itemid="itemid" />
    <rect
      :fill="`url(${fragment('foundation')})`"
      width="100%"
      height="100%" />
    <rect
      v-if="cutout"
      :fill="`url(${fragment('cutouts')})`"
      width="100%"
      height="100%" />
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
