<template>
  <defs>
    <pattern
      id="tile"
      patternUnits="userSpaceOnUse"
      width="75"
      height="75"
      viewBox="0 0 50 50">
      <line x1="1" y1="0" x2="51" y2="50" stroke="#19203d" stroke-width="2" />
      <line x1="49" y1="0" x2="-1" y2="50" stroke="#19203d" stroke-width="2" />
      <line x1="50" y1="0" x2="0" y2="50" stroke="#313763" stroke-width="2" />
      <line x1="0" y1="0" x2="50" y2="50" stroke="#313763" stroke-width="2" />
    </pattern>
    <radialGradient id="l" cx="50%" cy="200%" fy="0" r="201%">
      <stop offset="0%" style="stop-color: #fff; stop-opacity: 0.1" />
      <stop offset="10%" style="stop-color: #000; stop-opacity: 0.1" />
      <stop offset="30%" style="stop-color: #000; stop-opacity: 0.3" />
      <stop offset="90%" style="stop-color: #000; stop-opacity: 0.55" />
      <stop offset="100%" style="stop-color: #000; stop-opacity: 0.6" />
    </radialGradient>
    <rect id="bgRect" fill="#39466b" width="100%" height="100%" />
    <rect id="gradientRect" fill="url(#l)" width="100%" height="100%" />
    <rect id="tileRect" fill="url(#tile)" width="100%" height="100%" />

    <filter id="test" color-interpolation-filters="sRGB" y="0">
      <feImage href="#bgRect" result="bg" />
      <feImage href="#tileRect" result="tile" />
      <feImage href="#gradientRect" result="waves" />
      <feMerge>
        <feMergeNode in="bg" />
        <feMergeNode in="tile" />
        <feMergeNode in="waves" />
      </feMerge>
    </filter>
    <filter id="rough-it-up">
      <feTurbulence
        baseFrequency="0.1"
        type="fractalNoise"
        numOctaves="2"
        seed="83"
        in="flood" />
      <feFlood
        flood-color="rgba(0,0,0,0.5)"
        flood-opacity="0.91"
        result="flood" />
      <feBlend in="flood" in2="SourceGraphic" />
    </filter>
  </defs>
  <defs>
    <symbol :id="query('emboss-light')"> </symbol>
    <symbol :id="query('emboss-regular')"> </symbol>
    <symbol :id="query('emboss-bold')"> </symbol>

    <filter id="emboss">
      <feConvolveMatrix
        kernelMatrix="1.5 0 0
                      0   0 0
                      0   0 -1.5" />
    </filter>
    <filter id="emboss-opposite">
      <feConvolveMatrix
        kernelMatrix="0   0 2.5
                      0   0 0
                     -2.5 0 0" />
    </filter>
    <filter id="emboss-straight">
      <feConvolveMatrix
        kernelMatrix="0   0 0
                      2.5 0 -2.5
                      0   0 0" />
    </filter>
  </defs>
  <use
    tabindex="-1"
    class="emboss"
    opacity="0.66"
    :href="fragment('light')"
    filter="url(#emboss)" />
  <use
    tabindex="-1"
    class="emboss"
    opacity="0.66"
    :href="fragment('emboss-regular')" />
  <use
    tabindex="-1"
    class="emboss"
    opacity="0.66"
    :href="fragment('regular')"
    filter="url(#emboss-straight)" />
  <use
    tabindex="-1"
    class="emboss"
    opacity="0.66"
    :href="fragment('bold')"
    filter="url(#emboss-opposite)" />
</template>
<script setup>
  import { as_fragment_id, as_query_id } from '@/use/itemid'
  import { is_vector } from '@/use/vector'
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
<style lang="stylus">
  svg[itemtype="/posters"] use.emboss
    pointer-events: none
    user-select none
</style>
