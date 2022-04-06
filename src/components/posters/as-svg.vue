<template>
  <icon v-if="working" ref="trigger" name="working" :tabindex="focusable" />
  <svg
    v-else
    :id="id"
    itemscope
    :itemtype="`/${as_type(itemid)}`"
    :itemid="itemid"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    :tabindex="focusable"
    @click="click">
    <as-effects :vector="vector" />
    <defs>
      <filter id="emboss">
        <feConvolveMatrix
          kernelMatrix="3 0 0
                        0 0 0
                        0 0 -3" />
      </filter>
      <symbol v-if="vector.light" :id="query('light')">
        <as-path :path="vector.light" itemprop="light" />
      </symbol>
      <symbol v-if="vector.regular" :id="query('regular')">
        <as-path :path="vector.regular" itemprop="regular" />
      </symbol>
      <symbol :id="query('bold')">
        <as-path :path="vector.bold" itemprop="bold" />
      </symbol>
      <symbol :id="query('background')">
        <as-background
          :rect="vector.background"
          :tabable="tabable"
          @focus="focus('background')" />
        <rect
          width="100%"
          height="100%"
          :tabindex="tabindex"
          :fill="`url(${fragment('width-gradient')})`"
          :filter="`url(${fragment('background-filter')})`"
          @focus="focus('background-gradient')" />
      </symbol>
    </defs>
    <use :href="fragment('background')" />
    <use
      :href="fragment('light')"
      :tabindex="tabindex"
      :fill="`url(${fragment('width-gradient')})`"
      :filter="`url(${fragment('light-filter')})`"
      @focus="focus('light')" />
    <use class="emboss" :href="fragment('light')" filter="url(#emboss)" />
    <use
      :href="fragment('regular')"
      :tabindex="tabindex"
      :fill="`url(${fragment('height-gradient')})`"
      :filter="`url(${fragment('regular-filter')})`"
      @focus="focus('regular')" />
    <use class="emboss" :href="fragment('regular')" filter="url(#emboss)" />
    <use
      :href="fragment('bold')"
      :tabindex="tabindex"
      :fill="`url(${fragment('width-gradient')})`"
      :filter="`url(${fragment('bold-filter')})`"
      @focus="focus('bold')" />
    <use class="emboss" :href="fragment('bold')" filter="url(#emboss)" />
  </svg>
</template>
<script setup>
  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import AsEffects from '@/components/posters/as-effects'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import { onMounted as mounted, ref } from 'vue'
  import { as_type } from '@/use/itemid'
  import {
    use_poster,
    is_vector,
    is_vector_id,
    is_click,
    is_focus
  } from '@/use/vector'
  import icon from '@/components/icon'
  const emit = defineEmits({
    focus: is_focus,
    click: is_click,
    loaded: is_vector
  })
  const props = defineProps({
    immediate: {
      type: Boolean,
      required: false,
      default: false
    },
    toggle_aspect: {
      type: Boolean,
      required: false,
      default: true
    },
    slice: {
      type: Boolean,
      required: false,
      default: true
    },
    tabable: {
      type: Boolean,
      required: false,
      default: false
    },
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    },
    poster: {
      type: Object,
      required: false,
      default: null,
      validator: is_vector
    },
    as_stroke: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const {
    id,
    query,
    fragment: id_fragment,
    viewbox,
    aspect_ratio,
    click,
    working,
    show,
    should_show,
    focus,
    focusable,
    tabindex,
    vector
  } = use_poster(props, emit)
  const trigger = ref(null)
  const fragment = name => `${id_fragment.value}-${name}`
  use_intersect(
    trigger,
    ([{ isIntersecting }]) => {
      if (isIntersecting) show()
    },
    { rootMargin: '512px' }
  )
  mounted(should_show)
</script>
<style lang="stylus">
  svg[itemtype="/posters"]
  svg[itemtype="/avatars"]
    aspect-ratio: 16 / 9
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    outline: none
    // path
    //   display: none
</style>
