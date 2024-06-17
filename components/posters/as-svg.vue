<template>
  <icon v-if="working" ref="trigger" name="working" :tabindex="focusable" />
  <svg
    v-else
    :id="query()"
    ref="vector_element"
    itemscope
    itemtype="/posters"
    :itemid="itemid"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    :tabindex="focusable"
    :class="{ animate, landscape }"
    @click="click">
    <defs v-if="emboss" class="emboss">
      <defs class="static filters">
        <filter id="emboss">
          <feConvolveMatrix
            kernelMatrix="1.5 0 0
                          0   0 0
                          0   0 -1.5" />
        </filter>
        <filter id="emboss-opposite">
          <feConvolveMatrix
            kernelMatrix="0   0 1.5
                          0   0 0
                         -1.5 0 0" />
        </filter>
        <filter id="emboss-horizontal">
          <feConvolveMatrix
            kernelMatrix="0   0 0
                          1.5 0 -1.5
                          0   0 0" />
        </filter>
        <filter id="emboss-vertical">
          <feConvolveMatrix
            kernelMatrix="0    1.5 0
                          0    0   0
                          0   -1.5 0" />
        </filter>
      </defs>
      <filter
        :id="query('composite')"
        color-interpolation-filters="sRGB"
        y="0"
        x="0"
        width="100%"
        height="100%">
        <feImage v-if="light" href="#lightbar-rect" result="lighting" />
        <feImage :href="fragment('emboss-render-light')" result="light" />
        <feImage :href="fragment('emboss-render-regular')" result="regular" />
        <feImage :href="fragment('emboss-render-medium')" result="medium" />
        <feImage :href="fragment('emboss-render-bold')" result="bold" />
        <feImage :href="fragment('pattern-render')" result="framing" />
        <feMerge>
          <feMergeNode in="framing" />
          <feMergeNode v-if="light" in="lighting" />
          <feMergeNode in="bold" />
          <feMergeNode in="medium" />
          <feMergeNode in="regular" />
          <feMergeNode in="light" />
        </feMerge>
      </filter>

      <pattern
        :id="query('pattern-emboss-light')"
        :width="vector.width"
        :height="vector.height"
        :viewBox="vector.viewbox"
        patternUnits="userSpaceOnUse"
        :preserveAspectRatio="aspect_ratio">
        <use :href="fragment('light')" filter="url(#emboss)" opacity="0.45" />
      </pattern>
      <pattern
        :id="query('pattern-emboss-regular')"
        :width="vector.width"
        :height="vector.height"
        :viewBox="vector.viewbox"
        patternUnits="userSpaceOnUse"
        :preserveAspectRatio="aspect_ratio">
        <use :href="fragment('regular')" filter="url(#emboss-vertical)" />
      </pattern>
      <pattern
        :id="query('pattern-emboss-medium')"
        :width="vector.width"
        :height="vector.height"
        :viewBox="vector.viewbox"
        patternUnits="userSpaceOnUse"
        :preserveAspectRatio="aspect_ratio">
        <use :href="fragment('medium')" filter="url(#emboss-opposite)" />
      </pattern>
      <pattern
        :id="query('pattern-emboss-bold')"
        :width="vector.width"
        :height="vector.height"
        :viewBox="vector.viewbox"
        patternUnits="userSpaceOnUse"
        :preserveAspectRatio="aspect_ratio">
        <use :href="fragment('bold')" filter="url(#emboss-horizontal)" />
      </pattern>
      <rect
        :id="query('emboss-render')"
        :fill="`url(${fragment('pattern-emboss')})`"
        width="100%"
        height="100%" />
      <rect
        :id="query('emboss-render-light')"
        :fill="`url(${fragment('pattern-emboss-light')})`"
        width="100%"
        height="100%" />
      <rect
        :id="query('emboss-render-regular')"
        :fill="`url(${fragment('pattern-emboss-regular')})`"
        width="100%"
        height="100%" />
      <rect
        :id="query('emboss-render-medium')"
        :fill="`url(${fragment('pattern-emboss-medium')})`"
        width="100%"
        height="100%" />
      <rect
        :id="query('emboss-render-bold')"
        :fill="`url(${fragment('pattern-emboss-bold')})`"
        width="100%"
        height="100%" />
      <rect
        id="lightbar-rect"
        fill="url(#lightbar)"
        width="100%"
        height="100%" />
    </defs>
    <defs class="screen tone">
      <pattern
        id="light-screen-tone"
        x="-201.833"
        y="575.5"
        width="9"
        height="9"
        patternUnits="userSpaceOnUse"
        viewBox="0 -9 9 9">
        <path
          d="M9-7.875C9-7.254,8.496-6.75,7.875-6.75S6.75-7.254,6.75-7.875S7.254-9,7.875-9S9-8.496,9-7.875z" />
        <path
          d="M4.5-3.375c0,0.621-0.504,1.125-1.125,1.125S2.25-2.754,2.25-3.375S2.754-4.5,3.375-4.5S4.5-3.996,4.5-3.375z" />
      </pattern>
      <pattern
        id="medium-screen-tone"
        x="-201.833"
        y="575.5"
        width="18.403"
        height="9.366"
        patternUnits="userSpaceOnUse"
        viewBox="0 -9.366 18.403 9.366">
        <path
          d="M4.601-6.982c0,1.27-1.03,2.3-2.3,2.3S0-5.713,0-6.982c0-1.271,1.03-2.301,2.3-2.301S4.601-8.254,4.601-6.982z" />
        <path
          d="M13.802-2.383c0,1.271-1.03,2.301-2.3,2.301s-2.3-1.029-2.3-2.301c0-1.27,1.03-2.3,2.3-2.3S13.802-3.652,13.802-2.383z" />
      </pattern>
      <pattern
        id="dense-screen-tone"
        x="-201.833"
        y="575.5"
        width="9"
        height="9"
        patternUnits="userSpaceOnUse"
        viewBox="0 -9 9 9">
        <path
          d="M9-6.75C9-5.508,7.993-4.5,6.75-4.5S4.5-5.508,4.5-6.75S5.507-9,6.75-9S9-7.992,9-6.75z" />
        <path
          d="M4.5-2.25C4.5-1.008,3.493,0,2.25,0S0-1.008,0-2.25S1.007-4.5,2.25-4.5S4.5-3.492,4.5-2.25z" />
      </pattern>
    </defs>
    <defs class="graphic">
      <pattern
        :id="query('pattern')"
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
        <as-path
          v-if="vector.light"
          :id="query('light')"
          itemprop="light"
          :path="vector.light"
          :tabindex="tabindex"
          :mask="`url(${fragment('horizontal-mask')})`"
          :fill="`url(${fragment('vertical-light')})`"
          :stroke="`url(${fragment('horizontal-regular')})`"
          @focus="focus('light')" />
        <as-path
          v-if="vector.regular"
          :id="query('regular')"
          itemprop="regular"
          :path="vector.regular"
          :tabindex="tabindex"
          :mask="`url(${fragment('radial-mask')})`"
          :fill="`url(${fragment('horizontal-regular')})`"
          :stroke="`url(${fragment('radial-light')})`"
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
          @focus="focus('bold')" />
      </pattern>
      <rect
        :id="query('pattern-render')"
        :fill="`url(${fragment('pattern')})`"
        width="100%"
        height="100%" />
    </defs>
    <as-gradients :vector="vector" />
    <as-masks v-if="mask" :itemid="itemid" />
    <use :href="fragment('pattern-render')" />
    <rect
      v-if="emboss"
      :filter="`url(${fragment('composite')})`"
      width="100%"
      height="100%" />
    <g v-else>
      <use :href="fragment('background')" @focus="focus('bold')" />
      <use :href="fragment('light')" @focus="focus('light')" />
      <use :href="fragment('regular')" @focus="focus('regular')" />
      <use :href="fragment('medium')" @focus="focus('medium')" />
      <use :href="fragment('bold')" @focus="focus('bold')" />
    </g>
    <as-animation v-if="animate" :id="vector.id" />
  </svg>
</template>
<script setup>
  import Icon from '@/components/icon'
  import AsPath from '@/components/posters/as-path'
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
    computed
  } from 'vue'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use as use_optimizer } from '@/use/optimize'
  import {
    use_poster,
    is_vector,
    is_vector_id,
    is_click,
    is_focus
  } from '@/use/vector'
  import {
    animate as animate_pref,
    emboss as emboss_pref,
    light as light_pref
  } from '@/use/preference'
  defineEmits({
    focus: is_focus,
    click: is_click,
    loaded: is_vector
  })
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
  const trigger = ref(null)
  const emboss = computed(() => emboss_pref.value == true && intersecting.value)
  const animate = computed(
    () => animate_pref.value == true && intersecting.value
  )
  const light = computed(() => light_pref.value == true && intersecting.value)

  const mask = computed(() => intersecting.value)
  const landscape = computed(() => {
    if (!vector.value) return false
    const numbers = vector.value.viewbox.split(' ')
    const width = parseInt(numbers[2])
    const height = parseInt(numbers[3])
    return width > height
  })
  const new_poster = inject('new-poster', false)
  if (new_poster) {
    const { new_vector } = use_vectorize()
    vector.value = new_vector.value
    working.value = false
  }
  mounted(() => {
    if (!props.sync_poster && !new_poster) {
      use_intersect(
        trigger,
        ([{ isIntersecting }]) => {
          if (isIntersecting) show()
        },
        { rootMargin: '1024px' }
      )
    }
  })
  watch_effect(() => {
    if (props.sync_poster) {
      vector.value = props.sync_poster
      working.value = false
    }
  })
  watch_effect(() => {
    if (vector.value && props.optimize && !vector.value.optimized) {
      const { optimize } = use_optimizer(vector)
      optimize()
    }
  })
</script>
<style lang="stylus">
  // aspect-ratio: 1.618 / 1 // golden-ratio
  // aspect-ratio: 2.35 / 1 // current film
  // aspect-ratio: 16 / 9 // most like human vision
  // aspect-ratio: 1 / 1 // square
  svg[itemtype="/posters"]
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    outline: none
    & rect.emboss
      pointer-events: none
      user-select none
</style>
