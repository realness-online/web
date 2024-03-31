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
    :class="{ animate }"
    @click="click">
    <as-masks v-if="mask" :itemid="itemid" />
    <as-gradients :vector="vector" />
    <as-animation :vector="vector" />
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
      fill-opacity="0.90"
      :mask="`url(${fragment('horizontal-mask')})`"
      :fill="`url(${fragment('vertical-light')})`"
      :stroke="`url(${fragment('horizontal-regular')})`"
      @focus="focus('light')" />
    <as-path
      v-if="vector.regular"
      :id="query('regular')"
      itemprop="regular"
      fill-opacity="0.90"
      :path="vector.regular"
      :tabindex="tabindex"
      :mask="`url(${fragment('radial-mask')})`"
      :fill="`url(${fragment('horizontal-regular')})`"
      :stroke="`url(${fragment('radial-background')})`"
      @focus="focus('regular')" />
    <as-path
      v-if="vector.medium"
      :id="query('medium')"
      itemprop="medium"
      fill-opacity="0.90"
      :path="vector.medium"
      :tabindex="tabindex"
      :mask="`url(${fragment('vertical-mask')})`"
      :fill="`url(${fragment('vertical-medium')})`"
      :stroke="`url(${fragment('horizontal-medium')})`"
      @focus="focus('medium')" />
    <as-path
      v-if="vector.bold"
      :id="query('bold')"
      itemprop="bold"
      :tabindex="tabindex"
      :path="vector.bold"
      fill-opacity="0.90"
      :mask="`url(${fragment('horizontal-mask')})`"
      :fill="`url(${fragment('vertical-bold')})`"
      :stroke="`url(${fragment('radial-light')})`"
      @focus="focus('bold')" />
    <as-emboss v-if="show_emboss" :vector="vector" />
  </svg>
</template>
<script setup>
  import Icon from '@/components/icon'
  import AsPath from '@/components/posters/as-path'
  import AsMasks from '@/components/posters/as-masks'
  import AsBackground from '@/components/posters/as-background'
  import AsGradients from '@/components/posters/as-gradients'
  import AsAnimation from '@/components/posters/as-animation'
  import AsEmboss from '@/components/posters/as-emboss'
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
  defineEmits({
    focus: is_focus,
    click: is_click,
    loaded: is_vector
  })
  const props = defineProps({
    sync_poster: {
      type: Object,
      required: false,
      default: null,
      validator: is_vector
    },
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
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
  const show_emboss = computed(() => localStorage.emboss && intersecting.value)
  const animate = computed(() => localStorage.animate && intersecting.value)
  const mask = computed(() => localStorage.mask && intersecting.value)
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
  svg[itemtype="/posters"]
    // aspect-ratio: 1.618 / 1 // golden-ratio
    // aspect-ratio: 1 / 1.618 // golden-ratio
    // aspect-ratio: 2.35 / 1 // current film
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    outline: none
</style>
