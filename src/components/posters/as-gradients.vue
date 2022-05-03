<template>
  <defs>
    <g class="gradients">
      <radialGradient
        gradientUnits="userSpaceOnUse"
        :id="query('radial-gradient')">
        <stop
          v-for="stop in radial"
          :key="stop.offset"
          itemprop="radial"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </radialGradient>
      <linearGradient
        :id="query('vertical-gradient')"
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
        :id="query('horizontal-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <stop
          v-for="stop in horizontal"
          :key="stop.offset"
          itemprop="horizontal"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </linearGradient>
    </g>
    <g class="generated gradients">
      <radialGradient
        :id="query('background-gradient')"
        gradientUnits="userSpaceOnUse">
        <stop
          v-for="stop in background"
          :key="stop.offset"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </radialGradient>
      <linearGradient
        :id="query('light-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0%"
        x2="0"
        y1="0"
        y2="100%">
        <stop
          v-for="stop in light"
          :key="stop.offset"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </linearGradient>
      <linearGradient
        :id="query('regular-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <stop
          v-for="stop in regular"
          :key="stop.offset"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </linearGradient>
      <linearGradient
        :id="query('bold-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <stop
          v-for="stop in bold"
          :key="stop.offset"
          :stop-color="stop.color.hsla"
          :offset="`${stop.offset}%`" />
      </linearGradient>
    </g>
  </defs>
</template>
<script setup>
  import { ref, watchEffect as watch_effect, computed } from 'vue'
  import { is_vector_id, use_poster } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  import { color_to_hsla, hsla_to_color } from '@/use/colors'
  const { new_gradients: gradients, new_vector } = use_vectorize()
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
  const background = computed(() => {
    if (radial.value.length) {
      return radial.value.map(stop => {
        if (stop.color.l > 85) return stop
        else {
          return {
            offset: stop.offset,
            color: color_to_hsla({
              h: stop.color.h,
              s: stop.color.s,
              l: 80,
              a: 1
            })
          }
        }
      })
    } else {
      return [
        {
          offset: 0,
          color: color_to_hsla({
            h: 57,
            s: 13,
            l: 88,
            a: 1
          })
        }
      ]
    }
  })
  const light = computed(() => {
    if (vertical.value) {
      return vertical.value.map(stop => {
        return {
          offset: stop.offset,
          color: color_to_hsla({
            h: stop.color.h,
            s: stop.color.s,
            l: 60,
            a: 0.9
          })
        }
      })
    } else {
      return [
        {
          offset: 0,
          color: color_to_hsla({
            h: 300,
            s: 2,
            l: 2,
            a: 0.9
          })
        }
      ]
    }
  })
  const regular = computed(() => {
    if (horizontal.value) {
      return horizontal.value.map(stop => {
        return {
          offset: stop.offset,
          color: color_to_hsla({
            h: stop.color.h,
            s: stop.color.s,
            l: 50,
            a: 1
          })
        }
      })
    } else {
      return [
        {
          offset: 0,
          color: color_to_hsla({
            h: 300,
            s: 2,
            l: 2,
            a: 1
          })
        }
      ]
    }
  })
  const bold = computed(() => {
    if (vertical.value.length) {
      return vertical.value.map(stop => {
        return {
          offset: stop.offset,
          color: color_to_hsla({
            h: stop.color.h,
            s: 10,
            l: 8,
            a: 1
          })
        }
      })
    } else {
      return [
        {
          offset: 0,
          color: color_to_hsla({
            h: 300,
            s: 2,
            l: 2,
            a: 1
          })
        }
      ]
    }
  })
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
