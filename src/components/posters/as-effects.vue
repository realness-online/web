<template>
  <defs itemprop="effects">
    <g class="background effect">
      <filter :id="query('background-filter')">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 1 0" />
      </filter>
      <linearGradient
        :id="query('background-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0%"
        x2="0"
        y1="0"
        y2="100%">
        <stop
          v-for="stop in background"
          :stop-color="stop.color"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
    </g>
    <g class="light effect">
      <linearGradient
        :id="query('light-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <stop
          v-for="stop in light"
          :stop-color="stop.color"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
      <filter :id="query('light-filter')">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 1 0" />
      </filter>
    </g>
    <g class="regular effect">
      <linearGradient
        :id="query('regular-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <stop
          v-for="stop in regular"
          :stop-color="stop.color"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
      <filter :id="query('regular-filter')">
        <feTurbulence
          type="turbulence"
          baseFrequency="0.05"
          numOctaves="2"
          result="turbulence" />
        <feDisplacementMap
          in2="turbulence"
          in="SourceGraphic"
          scale="50"
          xChannelSelector="R"
          yChannelSelector="G" />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 1 0" />
      </filter>
    </g>
    <g class="bold effect">
      <linearGradient
        :id="query('bold-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <stop
          v-for="stop in bold"
          :stop-color="stop.color"
          :stop-opacity="stop.opacity"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
      <filter :id="query('bold-filter')">
        <feTurbulence
          type="turbulence"
          baseFrequency="0.05"
          numOctaves="2"
          result="turbulence" />
        <feDisplacementMap
          in2="turbulence"
          in="SourceGraphic"
          scale="50"
          xChannelSelector="R"
          yChannelSelector="G" />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0.75 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 1 0" />
      </filter>
    </g>
  </defs>
</template>
<script setup>
  import { ref } from 'vue'
  import { is_vector, use_poster } from '@/use/vector'
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const { query } = use_poster({ poster: props.vector })
  const background = ref(props.vector.effects?.background)
  const light = ref(props.vector.effects?.light)
  const regular = ref(props.vector.effects?.regular)
  const bold = ref(props.vector.effects?.bold)
</script>
