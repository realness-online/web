<script setup>
  import { as_fragment_id, as_query_id } from '@/utils/itemid'
  import { is_vector } from '@/use/poster'
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const query = add => `${as_query_id(props.vector.id)}-${add}`
  const fragment = add => `${as_fragment_id(props.vector.id)}-${add}`
</script>

<template>
  <defs class="texture example">
    <pattern
      id="tile"
      patternUnits="userSpaceOnUse"
      preserveAspectRatio="xMidYMid slice"
      width="21"
      height="34"
      viewBox="0 0 192 192">
      <rect fill="hsla(300,  1%, 33%, 0.75)" width="88" height="54" rx="8" />
      <rect
        fill="hsla(136, 47%, 57%, 0.75)"
        width="88"
        height="54"
        rx="8"
        x="104" />
      <rect
        fill="hsla(136, 47%, 57%, 0.75)"
        width="88"
        height="54"
        rx="8"
        y="69" />
      <rect
        fill="hsla(203, 58%, 57%, 0.75)"
        width="88"
        height="54"
        rx="8"
        x="104"
        y="69" />
      <rect
        fill="hsla(203, 58%, 57%, 0.75)"
        width="88"
        height="54"
        rx="8"
        y="138" />
      <rect
        fill="hsla(353, 83%, 57%, 0.75)"
        width="88"
        height="54"
        rx="8"
        x="104"
        y="138" />
    </pattern>
    <radialGradient id="l" cx="50%" cy="200%" fy="0" r="201%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.1" />
      <stop offset="10%" stop-color="#000" stop-opacity="0.1" />
      <stop offset="30%" stop-color="#000" stop-opacity="0.3" />
      <stop offset="90%" stop-color="#000" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#000" stop-opacity="0.6" />
    </radialGradient>
    <rect id="bgRect" fill="#39466b" width="100%" height="100%" />
    <rect id="gradientRect" fill="url(#l)" width="100%" height="100%" />
    <rect id="tileRect" fill="url(#tile)" width="100%" height="100%" />
    <filter id="stage" color-interpolation-filters="sRGB" y="0">
      <feImage href="#bgRect" result="bg" />
      <feImage href="#tileRect" result="tile" />
      <feImage href="#gradientRect" result="waves" />
      <feMerge>
        <!-- <feMergeNode in="bg" /> -->
        <!-- <feMergeNode in="tile" /> -->
        <feMergeNode in="waves" />
      </feMerge>
    </filter>
  </defs>
  <defs class="static filters">
    <filter id="emboss">
      <feConvolveMatrix
        kernelMatrix="2.5 0 0
                      0   0 0
                      0   0 -2.5" />
    </filter>
    <filter id="emboss-opposite">
      <feConvolveMatrix
        kernelMatrix="0   0 2.5
                      0   0 0
                     -2.5 0 0" />
    </filter>
    <filter id="emboss-horizontal">
      <feConvolveMatrix
        kernelMatrix="0   0 0
                      2.5 0 -2.5
                      0   0 0" />
    </filter>
    <filter id="emboss-vertical">
      <feConvolveMatrix
        kernelMatrix="0    2.5 0
                      0    0   0
                      0   -2.5 0" />
    </filter>
  </defs>
  <defs>
    <rect
      :id="query('emboss-render')"
      :fill="`url(${fragment('pattern-emboss')})`"
      width="100%"
      height="100%" />
    <rect
      :id="query('pattern-render')"
      :fill="`url(${fragment('pattern')})`"
      width="100%"
      height="100%" />
    <rect id="lightbar-rect" fill="url(#lightbar)" width="100%" height="100%" />
    <filter :id="query('composite')" color-interpolation-filters="sRGB" y="0">
      <feImage href="#lightbar-rect" result="waves" />
      <feImage :href="fragment('emboss-render')" result="puffy" />\
      <feImage :href="fragment('pattern-render')" result="frame" />
      <feMerge>
        <feMergeNode in="frame" />
        <feMergeNode in="waves" />
        <feMergeNode in="puffy" />
      </feMerge>
    </filter>
  </defs>
  <rect :filter="`url(${fragment('composite')})`" width="100%" height="100%" />
</template>

<style lang="stylus">
  svg[itemtype="/posters"] use.emboss
    pointer-events: none
    user-select none
</style>
