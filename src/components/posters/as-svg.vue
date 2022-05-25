<template>
  <icon v-if="working" ref="trigger" name="working" :tabindex="focusable" />
  <svg
    v-else
    :id="query()"
    itemscope
    :itemtype="`/${as_type(itemid)}`"
    :itemid="itemid"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    :tabindex="focusable"
    @click="click">
    <as-gradients :itemid="itemid" />
    <as-background
      :id="query('background')"
      :rect="vector.background"
      :tabindex="tabindex"
      :fill="`url(${fragment('radial-background')})`"
      @focus="focus('background')" />
    <as-path
      v-if="vector.light"
      :id="query('light')"
      itemprop="light"
      :path="vector.light"
      :tabindex="tabindex"
      :fill="`url(${fragment('vertical-light')})`"
      :stroke="`url(${fragment('horizontal-background')})`"
      @focus="focus('light')" />
    <as-path
      v-if="vector.regular"
      :id="query('regular')"
      itemprop="regular"
      :path="vector.regular"
      :tabindex="tabindex"
      :fill="`url(${fragment('horizontal-regular')})`"
      :stroke="`url(${fragment('vertical-light')})`"
      @focus="focus('regular')" />
    <as-path
      v-if="vector.bold"
      :id="query('bold')"
      itemprop="bold"
      :tabindex="tabindex"
      :path="vector.bold"
      :fill="`url(${fragment('vertical-bold')}`"
      :stroke="`url(${fragment('radial-regular')}`"
      @focus="focus('bold')" />

    <as-emboss v-if="show_emboss" :itemid="itemid" />
  </svg>
</template>
<script setup>
  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import AsGradients from '@/components/posters/as-gradients'
  import AsEmboss from '@/components/posters/as-emboss'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import { watchEffect as watch_effect, ref, inject, computed } from 'vue'
  import { as_type } from '@/use/itemid'
  import {
    use_poster,
    is_vector,
    is_vector_id,
    is_click,
    is_focus
  } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use as use_optimizer } from '@/use/optimize'
  import icon from '@/components/icon'
  const show_emboss = computed(() => localStorage.emboss)
  const emit = defineEmits({
    focus: is_focus,
    click: is_click,
    loaded: is_vector
  })
  const props = defineProps({
    immediate: {
      type: Boolean,
      required: false,
      default: false
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
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
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
    vector
  } = use_poster(props, emit)
  const trigger = ref(null)

  if (inject('new-poster', false)) {
    const { new_vector } = use_vectorize()
    vector.value = new_vector.value
    working.value = false
  } else {
    if (!props.immediate) {
      use_intersect(
        trigger,
        ([{ isIntersecting }]) => {
          if (isIntersecting) show()
        },
        { rootMargin: '612px' }
      )
    }
  }
  watch_effect(() => {
    if (vector.value && props.optimize && !vector.value.optimized) {
      const { optimize } = use_optimizer(vector)
      optimize()
    }
  })
</script>
<style lang="stylus">
  svg[itemtype="/posters"]
  svg[itemtype="/avatars"]
    aspect-ratio: 16 / 9
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    outline: none
    use.emboss[href$="bold"]:active
      stroke: yellow !important
      fill: yellow !important
      stroke-opacity: 1
      stroke-width: 6px
    // use.light, use.regular, use.bold, use.emboss, use.background
    //   display: none
</style>
