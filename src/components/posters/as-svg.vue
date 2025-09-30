<script setup>
  import Icon from '@/components/icon'
  import AsPath from '@/components/posters/as-path'
  import AsPathCutout from '@/components/posters/as-path-cutout'
  import AsMasks from '@/components/posters/as-masks'
  import AsBackground from '@/components/posters/as-background'
  import AsGradients from '@/components/posters/as-gradients'
  import AsAnimation from '@/components/posters/as-animation'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import {
    watchEffect as watch_effect,
    onMounted as mounted,
    ref,
    inject,
    computed,
    nextTick as tick,
    provide
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
    drama,
    background,
    bold,
    medium,
    regular,
    light,
    cutout,
    fill,
    stroke
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
    focusable,
    tabindex,
    vector,
    vector_element,
    intersecting,
    is_hovered,
    dynamic_viewbox,
    focus,
    wheel,
    reset,
    touch_start,
    touch_move,
    touch_end,
    focus_cutout,
    cutout_start,
    cutout_end,
    hovered_cutout
  } = use_poster()

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
  const { optimize: run_optimize } = use_optimizer(vector)
  const new_poster = inject('new-poster', false)
  const { new_vector } = use_vectorize()

  provide('vector', vector)

  if (new_poster) {
    vector.value = new_vector.value
    working.value = false
    watch_effect(() => {
      if (new_vector.value?.cutout)
        vector.value.cutout = new_vector.value.cutout
    })
    watch_effect(() => {
      if (new_vector.value?.completed && !vector.value.optimized) run_optimize()
    })
  }

  mounted(() => {
    if (!props.sync_poster && !new_poster)
      use_intersect(
        trigger,
        ([{ isIntersecting }]) => {
          if (isIntersecting) show()
        },
        { rootMargin: '1024px' }
      )
    else console.log('Skipping intersection observer setup')
  })

  watch_effect(() => {
    if (props.sync_poster) {
      vector.value = props.sync_poster
      working.value = false
      emit('show', vector.value)
    }
  })

  const background_visible = computed(
    () => vector.value?.background && background.value
  )
  const light_visible = computed(() => vector.value?.light && light.value)
  const regular_visible = computed(() => vector.value?.regular && regular.value)
  const medium_visible = computed(() => vector.value?.medium && medium.value)
  const bold_visible = computed(() => vector.value?.bold && bold.value)
  const cutout_visible = computed(() => vector.value?.cutout && cutout.value)
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
    @wheel.passive="wheel"
    @touchstart.passive="touch_start"
    @touchmove.passive="touch_move"
    @touchend.passive="touch_end">
    <pattern
      :id="query('shadow')"
      :width="vector.width"
      :height="vector.height"
      :viewBox="viewbox"
      patternUnits="userSpaceOnUse"
      :preserveAspectRatio="aspect_ratio">
      <as-background
        v-show="background_visible"
        :id="query('background')"
        :rect="vector.background"
        :width="vector.width"
        :height="vector.height"
        :tabindex="tabindex"
        fill-opacity="1"
        :fill="`url(${fragment('radial-background')})`"
        @focus="focus('background')" />
      <as-path
        v-show="light_visible"
        :id="query('light')"
        itemprop="light"
        :path="vector.light"
        :tabindex="tabindex"
        :mask="`url(${fragment('horizontal-mask')})`"
        :fill="`url(${fragment('vertical-light')})`"
        :stroke="`url(${fragment('horizontal-medium')})`"
        @focus="focus('light')" />
      <as-path
        v-show="regular_visible"
        :id="query('regular')"
        itemprop="regular"
        :path="vector.regular"
        :tabindex="tabindex"
        :mask="`url(${fragment('radial-mask')})`"
        :fill="`url(${fragment('horizontal-regular')})`"
        :stroke="`url(${fragment('vertical-bold')})`"
        @focus="focus('regular')" />
      <as-path
        v-show="medium_visible"
        :id="query('medium')"
        itemprop="medium"
        :path="vector.medium"
        :tabindex="tabindex"
        :mask="`url(${fragment('vertical-mask')})`"
        :fill="`url(${fragment('vertical-medium')})`"
        :stroke="`url(${fragment('vertical-background')})`"
        @focus="focus('medium')" />
      <as-path
        v-show="bold_visible"
        :id="query('bold')"
        itemprop="bold"
        :tabindex="tabindex"
        :path="vector.bold"
        :mask="`url(${fragment('horizontal-mask')})`"
        :fill="`url(${fragment('vertical-bold')})`"
        :stroke="`url(${fragment('radial-light')})`"
        @focus="focus('bold')" />
    </pattern>
    <as-gradients v-if="vector" :vector="vector" />
    <as-masks :itemid="itemid" />
    <rect
      v-show="fill || stroke"
      :fill="`url(${fragment('shadow')})`"
      width="100%"
      height="100%" />
    <rect
      v-show="drama"
      id="lightbar-back"
      fill="url(#lightbar)"
      width="100%"
      height="100%" />
    <g :id="query('cutouts')" v-show="cutout_visible" style="fill-opacity: 0.5">
      <as-path-cutout
        v-for="(cutout, index) in vector.cutout"
        :key="`cutout-${index}`"
        :cutout="cutout"
        :index="index"
        :class="{ hovered: hovered_cutout === index }"
        @focus="focus_cutout"
        @touchstart="cutout_start"
        @touchend="cutout_end" />
    </g>
    <rect
      v-show="drama"
      id="lightbar-front"
      fill="url(#lightbar)"
      width="100%"
      height="100%" />
    <as-animation v-if="animate" :id="vector.id" />
  </svg>
</template>

<style>
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
    outline: none;
    cursor: grab;
    transition: all 0.3s ease;
    -webkit-tap-highlight-color: transparent;
    contain: layout;
    &:active {
      cursor: grabbing;
    }
    & rect#lightbar-back,
    & rect#lightbar-front {
      pointer-events: none;
    }
  }
</style>
