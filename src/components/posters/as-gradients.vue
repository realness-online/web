<script setup>
  import AsStops from '@/components/posters/as-stops'
  import { as_query_id } from '@/utils/itemid'
  import { ref, watchEffect as watch_effect } from 'vue'
  import { is_vector } from '@/use/poster'
  import { use as use_vectorize } from '@/use/vectorize'
  import { hsla_to_color } from '@/utils/colors'
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const { new_gradients: gradients } = use_vectorize()
  const background = 81
  const light = 60
  const regular = 44
  const medium = 20
  const bold = 10
  const query = add => {
    if (!props.vector) return add
    if (add) return `${as_query_id(props.vector.id)}-${add}`
    return as_query_id(props.vector.id)
  }
  const default_color = {
    offset: '0',
    color: {
      hsla: 'hsla(300,  1%, 2%, 1)',
      hsl: 'hsl(300,  1%, 2%)',
      h: 300,
      s: 1,
      l: 2,
      a: 1
    }
  }
  const horizontal = ref([default_color])
  const vertical = ref([default_color])
  const radial = ref([default_color])
  const convert_stop = stop => ({
    color: hsla_to_color(stop.getAttribute('stop-color')),
    offset: stop.getAttribute('offset').replace('%', '')
  })
  watch_effect(() => {
    if (gradients.value) {
      horizontal.value = gradients.value.horizontal
      vertical.value = gradients.value.vertical
      radial.value = gradients.value.radial
    } else if (props.vector) {
      if (props.vector.horizontal?.map)
        horizontal.value = props.vector.horizontal.map(convert_stop)

      if (props.vector.vertical?.map)
        vertical.value = props.vector.vertical.map(convert_stop)

      if (props.vector.radial?.map)
        radial.value = props.vector.radial.map(convert_stop)
    }
  })
</script>

<template>
  <radialGradient id="lightbar" cx="50%" cy="200%" fy="0" r="401%">
    <stop offset="0%" stop-color="#fff" stop-opacity="0.1" />
    <stop offset="2%" stop-color="#fff" stop-opacity="0.09" />
    <stop offset="5%" stop-color="#fff" stop-opacity="0.07" />
    <stop offset="8%" stop-color="#000" stop-opacity="0.08" />
    <stop offset="12%" stop-color="#000" stop-opacity="0.12" />
    <stop offset="18%" stop-color="#000" stop-opacity="0.18" />
    <stop offset="25%" stop-color="#000" stop-opacity="0.25" />
    <stop offset="35%" stop-color="#000" stop-opacity="0.35" />
    <stop offset="45%" stop-color="#000" stop-opacity="0.42" />
    <stop offset="55%" stop-color="#000" stop-opacity="0.48" />
    <stop offset="65%" stop-color="#000" stop-opacity="0.52" />
    <stop offset="75%" stop-color="#000" stop-opacity="0.54" />
    <stop offset="85%" stop-color="#000" stop-opacity="0.56" />
    <stop offset="92%" stop-color="#000" stop-opacity="0.58" />
    <stop offset="96%" stop-color="#000" stop-opacity="0.59" />
    <stop offset="100%" stop-color="#000" stop-opacity="0.6" />
  </radialGradient>
  <g class="radial">
    <radialGradient :id="query('radial')" gradientUnits="userSpaceOnUse">
      <stop
        v-for="stop in radial"
        :key="stop.offset"
        itemprop="radial"
        :stop-color="stop.color.hsla"
        :offset="`${stop.offset}%`" />
    </radialGradient>
    <radialGradient
      :id="query('radial-background')"
      gradientUnits="userSpaceOnUse">
      <as-stops
        :luminosity="background"
        :saturation_floor="13"
        :stops="radial" />
    </radialGradient>
    <radialGradient :id="query('radial-light')" gradientUnits="userSpaceOnUse">
      <as-stops :luminosity="light" :stops="radial" />
    </radialGradient>
    <radialGradient
      :id="query('radial-regular')"
      gradientUnits="userSpaceOnUse">
      <as-stops :luminosity="regular" :stops="radial" />
    </radialGradient>
    <radialGradient :id="query('radial-medium')" gradientUnits="userSpaceOnUse">
      <as-stops :luminosity="medium" :stops="radial" />
    </radialGradient>
    <radialGradient :id="query('radial-bold')" gradientUnits="userSpaceOnUse">
      <as-stops :luminosity="bold" :stops="radial" />
    </radialGradient>
  </g>
  <g class="vertical">
    <linearGradient
      :id="query('vertical')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="0"
      y1="0"
      y2="100%">
      <stop
        v-for="stop in vertical"
        :key="stop.offset"
        itemprop="vertical"
        :stop-color="stop.color.hsla"
        :offset="`${stop.offset}%`" />
    </linearGradient>
    <linearGradient
      :id="query('vertical-background')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="0"
      y1="0"
      y2="100%">
      <as-stops :luminosity="background" :stops="vertical" />
    </linearGradient>
    <linearGradient
      :id="query('vertical-light')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="0"
      y1="0"
      y2="100%">
      <as-stops :luminosity="light" :saturation_floor="21" :stops="vertical" />
    </linearGradient>
    <linearGradient
      :id="query('vertical-regular')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="0"
      y1="0"
      y2="100%">
      <as-stops :luminosity="regular" :stops="vertical" />
    </linearGradient>
    <linearGradient
      :id="query('vertical-medium')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="0"
      y1="0"
      y2="100%">
      <as-stops :luminosity="medium" :stops="vertical" />
    </linearGradient>
    <linearGradient :id="query('vertical-bold')" x1="0" x2="0" y1="0" y2="100%">
      <as-stops :luminosity="bold" :stops="vertical" />
    </linearGradient>
  </g>
  <g class="horizontal">
    <linearGradient
      :id="query('horizontal')"
      x1="0"
      x2="100%"
      y1="0"
      y2="0"
      gradientUnits="userSpaceOnUse">
      <stop
        v-for="stop in horizontal"
        :key="stop.offset"
        itemprop="horizontal"
        :stop-color="stop.color.hsla"
        :offset="`${stop.offset}%`" />
    </linearGradient>
    <linearGradient
      :id="query('horizontal-background')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="100%"
      y1="0"
      y2="0">
      <as-stops :luminosity="background" :stops="horizontal" />
    </linearGradient>
    <linearGradient
      :id="query('horizontal-light')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="100%"
      y1="0"
      y2="0">
      <as-stops :luminosity="light" :stops="horizontal" />
    </linearGradient>
    <linearGradient
      :id="query('horizontal-regular')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="100%"
      y1="0"
      y2="0">
      <as-stops
        :luminosity="regular"
        :saturation_floor="18"
        :stops="horizontal" />
    </linearGradient>
    <linearGradient
      :id="query('horizontal-medium')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="100%"
      y1="0"
      y2="0">
      <as-stops
        :luminosity="medium"
        :saturation_floor="18"
        :stops="horizontal" />
    </linearGradient>
    <linearGradient
      :id="query('horizontal-bold')"
      gradientUnits="userSpaceOnUse"
      x1="0"
      x2="100%"
      y1="0"
      y2="0">
      <as-stops :luminosity="bold" :stops="horizontal" />
    </linearGradient>
  </g>
</template>
