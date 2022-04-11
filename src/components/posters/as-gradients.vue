<template>
  <defs>
    <g class="gradients">
      <radialGradient
        :id="query('radial')"
        itemprop="radial"
        gradientUnits="userSpaceOnUse">
        <stop
          v-for="stop in radial"
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
      </radialGradient>
      <linearGradient
        :id="query('height')"
        itemprop="height"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="0"
        y1="0"
        y2="100%">
        <stop
          v-for="stop in height"
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
      <linearGradient
        :id="query('width')"
        itemprop="width"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <stop
          v-for="stop in width"
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
    </g>
    <g class="generated gradients">
      <radialGradient
        :id="query('background-gradient')"
        gradientUnits="userSpaceOnUse">
        <stop
          v-for="stop in background"
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
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
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
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
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
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
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
    </g>
  </defs>
</template>
<script setup>
  import { ref, watchEffect as watch_effect, computed } from 'vue'
  import { is_vector_id, use_poster } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  import { color_to_hsla } from '@/use/colors'
  const { new_gradients: gradients, new_vector } = use_vectorize()
  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })
  const { query, vector, show } = use_poster(props, () => {})
  const width = ref([])
  const height = ref([])
  const radial = ref([])
  const background = computed(() => {
    if (radial.value.length) {
      return radial.value.map(stop => {
        if (stop.color.l > 85) return stop
        else {
          const color = color_to_hsla({
            h: stop.color.h,
            s: stop.color.s,
            l: 80,
            a: 1
          })
          return {
            color,
            percentage: stop.percentage
          }
        }
      })
    } else {
      return [
        {
          color: color_to_hsla({
            h: 57,
            s: 13,
            l: 88,
            a: 1
          }),
          percentage: 0
        }
      ]
    }
  })
  const light = computed(() => {
    if (height.value) {
      return height.value.map(stop => {
        if ((stop.color.l = 10)) return stop
        else {
          const color = color_to_hsla({
            h: stop.color.h,
            s: stop.color.s,
            l: 60,
            a: 1
          })
          return {
            color,
            percentage: stop.percentage
          }
        }
      })
    } else {
      return [
        {
          color: color_to_hsla({
            h: 300,
            s: 2,
            l: 2,
            a: 1
          }),
          percentage: 0
        }
      ]
    }
  })
  const regular = computed(() => {
    if (width.value) {
      return width.value.map(stop => {
        const color = color_to_hsla({
          h: stop.color.h,
          s: stop.color.s + 10,
          l: 50,
          a: 1
        })
        return {
          color,
          percentage: stop.percentage
        }
      })
    } else {
      return [
        {
          color: color_to_hsla({
            h: 300,
            s: 2,
            l: 2,
            a: 1
          }),
          percentage: 0
        }
      ]
    }
  })
  const bold = computed(() => {
    if (width.value.length) {
      return width.value.map(stop => {
        const color = color_to_hsla({
          h: stop.color.h,
          s: 10,
          l: 8,
          a: 1
        })
        return {
          color,
          percentage: stop.percentage
        }
      })
    } else {
      return [
        {
          color: color_to_hsla({
            h: 300,
            s: 2,
            l: 2,
            a: 1
          }),
          percentage: 0
        }
      ]
    }
  })

  if (new_vector.value) vector.value = new_vector.value
  show()
  watch_effect(() => {
    if (!gradients.value) return
    width.value = gradients.value.width
    height.value = gradients.value.height
    radial.value = gradients.value.radial
  })
</script>
