<template>
  <defs class="gradients">
    <g class="radial">
      <radialGradient :id="query('radial')">
        <stop
          v-for="stop in radial"
          :key="stop.offset"
          itemprop="radial"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </radialGradient>
      <radialGradient :id="query('radial-background')">
        <as-stops :luminosity="background" :stops="radial" />
      </radialGradient>
      <radialGradient :id="query('radial-light')">
        <as-stops :luminosity="light" :stops="radial" />
      </radialGradient>
      <radialGradient :id="query('radial-regular')">
        <as-stops :luminosity="regular" :stops="radial" />
      </radialGradient>
      <radialGradient :id="query('radial-bold')">
        <as-stops :luminosity="bold" :stops="radial" />
      </radialGradient>
    </g>
    <g class="vertical">
      <linearGradient :id="query('vertical')" x1="0" x2="0" y1="0" y2="100%">
        <stop
          itemprop="vertical"
          v-for="stop in vertical"
          :key="stop.offset"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </linearGradient>
      <linearGradient
        :id="query('vertical-background')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%">
        <as-stops :luminosity="background" :stops="vertical" />
      </linearGradient>
      <linearGradient
        :id="query('vertical-light')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%">
        <as-stops :luminosity="light" :stops="vertical" />
      </linearGradient>
      <linearGradient
        :id="query('vertical-regular')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%">
        <as-stops :luminosity="regular" :stops="vertical" />
      </linearGradient>
      <linearGradient
        :id="query('vertical-bold')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%">
        <as-stops :luminosity="bold" :stops="vertical" />
      </linearGradient>
    </g>
    <g class="horizontal">
      <linearGradient :id="query('horizontal')" x1="0" x2="100%" y1="0" y2="0">
        <stop
          v-for="stop in horizontal"
          :key="stop.offset"
          itemprop="horizontal"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </linearGradient>
      <linearGradient
        :id="query('horizontal-background')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <as-stops :luminosity="background" :stops="horizontal" />
      </linearGradient>
      <linearGradient
        :id="query('horizontal-light')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <as-stops :luminosity="light" :stops="horizontal" />
      </linearGradient>
      <linearGradient
        :id="query('horizontal-regular')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <as-stops :luminosity="regular" :stops="horizontal" />
      </linearGradient>
      <linearGradient
        :id="query('horizontal-bold')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <as-stops :luminosity="bold" :stops="horizontal" />
      </linearGradient>
    </g>
  </defs>
</template>
<script setup>
  import AsStops from '@/components/posters/as-stops'
  import { ref, watchEffect as watch_effect, computed } from 'vue'
  import { is_vector_id, use_poster } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  import { color_to_hsla, hsla_to_color } from '@/use/colors'
  const { new_gradients: gradients, new_vector } = use_vectorize()
  const background = 80
  const light = 60
  const regular = 40
  const bold = 13
  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })
  const { query, vector, show } = use_poster(props, () => {})
  const horizontal = ref([])
  const vertical = ref([])
  const radial = ref([])
  const convert_stop = stop => {
    return {
      color: hsla_to_color(stop.getAttribute('stop-color')),
      offset: stop.getAttribute('offset').replace('%', '')
    }
  }
  if (new_vector.value) vector.value = new_vector.value
  show()
  watch_effect(() => {
    if (gradients.value) {
      horizontal.value = gradients.value.horizontal
      vertical.value = gradients.value.vertical
      radial.value = gradients.value.radial
    } else if (vector.value) {
      if (vector.value.horizontal) {
        horizontal.value = vector.value.horizontal.map(convert_stop)
      }
      if (vector.value.vertical) {
        vertical.value = vector.value.vertical.map(convert_stop)
      }
      if (vector.value.radial) {
        radial.value = vector.value.radial.map(convert_stop)
      }
    }
  })
</script>
