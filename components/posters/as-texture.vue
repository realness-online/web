<template>
  <defs class="emboss">
    <symbol :id="query('emboss-symbol')">
      <defs>
        <symbol :id="query('emboss-light')">
          <use :href="fragment('light')" filter="url(#emboss)" />
        </symbol>
        <symbol :id="query('emboss-regular')">
          <use :href="fragment('regular')" filter="url(#emboss-straight)" />
        </symbol>
        <symbol :id="query('emboss-bold')">
          <use :href="fragment('bold')" filter="url(#emboss-opposite)" />
        </symbol>

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
        :href="fragment('emboss-light')" />
      <use
        tabindex="-1"
        class="emboss"
        opacity="0.66"
        :href="fragment('emboss-regular')" />
      <use
        tabindex="-1"
        class="emboss"
        opacity="0.66"
        :href="fragment('emboss-bold')" />
    </symbol>
  </defs>
  <defs class="texture global">
    <filter id="stage-slow" color-interpolation-filters="sRGB" y="0">
      <feImage :href="`${icons}#background`" result="bg" />
      <feImage :href="`${icons}#realness`" result="tile" />
      <feImage href="#gradientRect" result="waves" />
      <feMerge>
        <feMergeNode in="bg" />
        <feMergeNode in="tile" />
      </feMerge>
    </filter>
  </defs>
  <defs class="texture shadow"></defs>

</template>
<script setup>
  import icons from '/icons.svg'
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
