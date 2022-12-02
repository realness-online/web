<template>
  <defs class="gradients">
    <g class="radial">
      <radialGradient
        :id="query('radial')"
        gradientTransform="rotate(-30 190 190)">
        <stop
          v-for="stop in radial"
          :key="stop.offset"
          itemprop="radial"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
        <animate-gradient />
      </radialGradient>
      <radialGradient
        :id="query('radial-background')"
        gradientTransform="rotate(-30 190 190)">
        <as-stops
          :luminosity="background"
          :saturation_floor="13"
          :stops="radial" />
        <animate-gradient />
      </radialGradient>
      <radialGradient
        :id="query('radial-light')"
        gradientTransform="rotate(-30 190 190)">
        <as-stops :luminosity="light" :stops="radial" />
        <animate-gradient />
      </radialGradient>
      <radialGradient
        :id="query('radial-regular')"
        gradientTransform="rotate(-30 190 190)">
        <as-stops :luminosity="regular" :stops="radial" />
        <animate-gradient />
      </radialGradient>
      <radialGradient
        :id="query('radial-bold')"
        gradientTransform="rotate(-30 190 190)">
        <as-stops :luminosity="bold" :stops="radial" />
        <animate-gradient />
      </radialGradient>
    </g>
    <g class="vertical">
      <linearGradient
        :id="query('vertical')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%"
        gradientTransform="rotate(0)">
        <stop
          v-for="stop in vertical"
          :key="stop.offset"
          itemprop="vertical"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
        <animate-gradient />
      </linearGradient>
      <linearGradient
        :id="query('vertical-background')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%"
        gradientTransform="rotate(0)">
        <as-stops :luminosity="background" :stops="vertical" />
        <animate-gradient />
      </linearGradient>
      <linearGradient
        :id="query('vertical-light')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%"
        gradientTransform="rotate(0)">
        <as-stops
          :luminosity="light"
          :saturation_floor="21"
          :stops="vertical" />
        <animate-gradient />
      </linearGradient>
      <linearGradient
        :id="query('vertical-regular')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%"
        gradientTransform="rotate(0)">
        <as-stops :luminosity="regular" :stops="vertical" />
        <animate-gradient />
      </linearGradient>
      <linearGradient
        :id="query('vertical-bold')"
        x1="0"
        x2="0"
        y1="0"
        y2="100%"
        gradientTransform="rotate(0)">
        <as-stops :luminosity="bold" :stops="vertical" />
        <animate-gradient />
      </linearGradient>
    </g>
    <g class="horizontal">
      <linearGradient
        :id="query('horizontal')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0"
        gradientTransform="rotate(0)">
        <stop
          v-for="stop in horizontal"
          :key="stop.offset"
          itemprop="horizontal"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
        <animate-gradient />
      </linearGradient>
      <linearGradient
        :id="query('horizontal-background')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0"
        gradientTransform="rotate(0)">
        <as-stops :luminosity="background" :stops="horizontal" />
        <animate-gradient />
      </linearGradient>
      <linearGradient
        :id="query('horizontal-light')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0"
        gradientTransform="rotate(0)">
        <as-stops :luminosity="light" :stops="horizontal" />
        <animate-gradient />
      </linearGradient>
      <linearGradient
        :id="query('horizontal-regular')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0"
        gradientTransform="rotate(0)">
        <as-stops
          :luminosity="regular"
          :saturation_floor="18"
          :stops="horizontal" />
      </linearGradient>
      <linearGradient
        :id="query('horizontal-bold')"
        x1="0"
        x2="100%"
        y1="0"
        y2="0"
        gradientTransform="rotate(0)">
        <as-stops :luminosity="bold" :stops="horizontal" />
        <animate-gradient />
      </linearGradient>
    </g>
  </defs>
</template>
<script setup>
  import AsStops from '@/components/posters/as-stops'
  import AnimateGradient from '@/components/animations/gradient-transform'
  import { as_query_id } from '@/use/itemid'
  import { ref, watchEffect as watch_effect } from 'vue'
  import { is_vector } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  import { hsla_to_color } from '@/use/colors'
  const { new_gradients: gradients } = use_vectorize()
  const background = 80
  const light = 66
  const regular = 44
  const bold = 13
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const query = add => {
    if (!props.vector) return add
    if (add) return `${as_query_id(props.vector.id)}-${add}`
    else return as_query_id(props.vector.id)
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
  const convert_stop = stop => {
    return {
      color: hsla_to_color(stop.getAttribute('stop-color')),
      offset: stop.getAttribute('offset').replace('%', '')
    }
  }
  watch_effect(() => {
    if (gradients.value) {
      horizontal.value = gradients.value.horizontal
      vertical.value = gradients.value.vertical
      radial.value = gradients.value.radial
    } else if (props.vector) {
      if (props.vector.horizontal) {
        horizontal.value = props.vector.horizontal.map(convert_stop)
      }
      if (props.vector.vertical) {
        vertical.value = props.vector.vertical.map(convert_stop)
      }
      if (props.vector.radial) {
        radial.value = props.vector.radial.map(convert_stop)
      }
    }
  })
</script>
