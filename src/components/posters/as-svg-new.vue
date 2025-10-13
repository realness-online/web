<script setup>
  import Icon from '@/components/icon'
  import AsPath from '@/components/posters/as-path'
  import AsPathCutout from '@/components/posters/as-path-cutout'
  import AsMasks from '@/components/posters/as-masks'
  import AsBackground from '@/components/posters/as-background'
  import AsGradients from '@/components/posters/as-gradients'
  import { ref, computed, watchEffect as watch_effect, provide } from 'vue'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use as use_optimizer } from '@/use/optimize'
  import { use as use_poster, is_vector_id } from '@/use/poster'

  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })

  const { query, fragment, viewbox, aspect_ratio, vector, vector_element } =
    use_poster()

  const { new_vector, progress } = use_vectorize()
  const { optimize: run_optimize } = use_optimizer(vector)

  provide('vector', vector)

  // Set vector from new_vector
  vector.value = new_vector.value

  watch_effect(() => {
    if (new_vector.value) vector.value = new_vector.value
  })

  watch_effect(() => {
    if (new_vector.value?.cutout) vector.value.cutout = new_vector.value.cutout
  })

  watch_effect(() => {
    if (new_vector.value?.completed && !vector.value.optimized) run_optimize()
  })

  // Fixed visibility - always show background and fill, no animation
  const background_visible = ref(true)
  const light_visible = computed(() => vector.value?.light)
  const regular_visible = computed(() => vector.value?.regular)
  const medium_visible = computed(() => vector.value?.medium)
  const bold_visible = computed(() => vector.value?.bold)
  const cutout_visible = computed(() => vector.value?.cutout)
  const fill_visible = ref(true)
  const working = computed(() => !vector.value)
</script>

<template>
  <icon v-if="working" name="working" />
  <svg
    v-else
    ref="vector_element"
    :id="query()"
    itemscope
    itemtype="/posters"
    :itemid="itemid"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio">
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
        fill-opacity="1"
        :fill="`url(${fragment('radial-background')})`" />
      <as-path
        v-show="light_visible"
        :id="query('light')"
        itemprop="light"
        :path="vector.light"
        :tabindex="-1"
        :mask="`url(${fragment('horizontal-mask')})`"
        :fill="`url(${fragment('vertical-light')})`"
        :stroke="`url(${fragment('horizontal-medium')})`" />
      <as-path
        v-show="regular_visible"
        :id="query('regular')"
        itemprop="regular"
        :path="vector.regular"
        :tabindex="-1"
        :mask="`url(${fragment('radial-mask')})`"
        :fill="`url(${fragment('horizontal-regular')})`"
        :stroke="`url(${fragment('vertical-bold')})`" />
      <as-path
        v-show="medium_visible"
        :id="query('medium')"
        itemprop="medium"
        :path="vector.medium"
        :tabindex="-1"
        :mask="`url(${fragment('vertical-mask')})`"
        :fill="`url(${fragment('vertical-medium')})`"
        :stroke="`url(${fragment('vertical-background')})`" />
      <as-path
        v-show="bold_visible"
        :id="query('bold')"
        itemprop="bold"
        :tabindex="-1"
        :path="vector.bold"
        :mask="`url(${fragment('horizontal-mask')})`"
        :fill="`url(${fragment('vertical-bold')})`"
        :stroke="`url(${fragment('radial-light')})`" />
    </pattern>
    <as-gradients v-if="vector" :vector="vector" />
    <as-masks :itemid="itemid" />
    <rect
      v-show="fill_visible"
      :fill="`url(${fragment('shadow')})`"
      width="100%"
      height="100%" />
    <g :id="query('cutouts')" v-show="cutout_visible" style="fill-opacity: 0.5">
      <as-path-cutout
        v-for="(cut, index) in vector.cutout"
        :key="`cutout-${index}`"
        :cutout="cut"
        :index="index" />
    </g>
  </svg>
</template>

<style>
  svg[itemtype='/posters'] {
    display: block;
    min-height: 512px;
    height: 100%;
    width: 100%;
    outline: none;
    contain: layout;
  }
</style>

