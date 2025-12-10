<script setup>

  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import { use as use_pattern } from '@/use/pattern'
  import { use as use_poster } from '@/use/poster'

  const emit = defineEmits({
    focus: Function
  })

  const {
    query,
    fragment,
    width,
    height,
    viewbox,
    aspect_ratio,
    tabindex,
    vector,
    background_visible,
    light_visible,
    regular_visible,
    medium_visible,
    bold_visible
  } = use_pattern()

  const { focus } = use_poster()

  const handle_focus = layer => {
    focus(layer)
    emit('focus', layer)
  }
</script>

<template>
  <pattern
    :id="query('shadow')"
    :itemid="query('shadow')"
    itemscope
    itemtype="/shadows"
    v-if="vector && vector.light && vector.regular && vector.medium && vector.bold"
    :width="width"
    :height="height"
    :viewBox="viewbox"
    patternUnits="userSpaceOnUse"
    :preserveAspectRatio="aspect_ratio">
    <as-background
      :id="query('background')"
      :rect="vector.background"
      :width="width"
      :height="height"
      :tabindex="tabindex"
      :visible="background_visible"
      fill-opacity="1"
      :fill="`url(${fragment('radial-background')})`"
      @focus="handle_focus('background')" />
    <as-path
      v-if="vector.light"
      :id="query('light')"
      itemprop="light"
      :path="vector.light"
      :tabindex="tabindex"
      :visible="light_visible"
      :mask="`url(${fragment('horizontal-mask')})`"
      :fill="`url(${fragment('vertical-light')})`"
      :stroke="`url(${fragment('horizontal-medium')})`"
      @focus="handle_focus('light')" />
    <as-path
      v-if="vector.regular"
      :id="query('regular')"
      itemprop="regular"
      :path="vector.regular"
      :tabindex="tabindex"
      :visible="regular_visible"
      :mask="`url(${fragment('radial-mask')})`"
      :fill="`url(${fragment('horizontal-regular')})`"
      :stroke="`url(${fragment('vertical-bold')})`"
      @focus="handle_focus('regular')" />
    <as-path
      v-if="vector.medium"
      :id="query('medium')"
      itemprop="medium"
      :path="vector.medium"
      :tabindex="tabindex"
      :visible="medium_visible"
      :mask="`url(${fragment('vertical-mask')})`"
      :fill="`url(${fragment('vertical-medium')})`"
      :stroke="`url(${fragment('vertical-background')})`"
      @focus="handle_focus('medium')" />
    <as-path
      v-if="vector.bold"
      :id="query('bold')"
      itemprop="bold"
      :tabindex="tabindex"
      :path="vector.bold"
      :visible="bold_visible"
      :mask="`url(${fragment('horizontal-mask')})`"
      :fill="`url(${fragment('vertical-bold')})`"
      :stroke="`url(${fragment('radial-light')})`"
      @focus="handle_focus('bold')" />
  </pattern>
</template>
