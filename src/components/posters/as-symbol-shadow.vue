<script setup>
  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import { use as use_pattern } from '@/use/pattern'
  import { use as use_poster, is_rect } from '@/use/poster'
  import { computed } from 'vue'
  import { as_layer_id, as_query_id } from '@/utils/itemid'

  const emit = defineEmits({
    focus: Function
  })

  const {
    width,
    height,
    viewbox,
    aspect_ratio,
    tabindex,
    vector,
    itemid,
    background_visible,
    light_visible,
    regular_visible,
    medium_visible,
    bold_visible,
    fragment: pattern_fragment
  } = use_pattern()

  const { focus } = use_poster()

  const layer_id = computed(() => as_layer_id(itemid.value, 'shadows'))

  const query = add => {
    if (!layer_id.value) return add || ''
    if (add) return `${as_query_id(layer_id.value)}-${add}`
    return as_query_id(layer_id.value)
  }

  const gradient_fragment = add => pattern_fragment(add)

  const valid_rect = computed(() => {
    if (!vector.value?.background) return null
    if (is_rect(vector.value.background)) return vector.value.background
    return null
  })

  const handle_focus = layer => {
    focus(layer)
    emit('focus', layer)
  }
</script>

<template>
  <symbol
    :id="query()"
    :itemid="as_layer_id(itemid, 'shadows')"
    itemscope
    itemtype="/shadows"
    v-if="
      vector && vector.light && vector.regular && vector.medium && vector.bold
    "
    :width="width"
    :height="height"
    :viewBox="viewbox"
    patternUnits="userSpaceOnUse"
    :preserveAspectRatio="aspect_ratio">
    <as-background
      :id="query('background')"
      :rect="valid_rect"
      :width="width"
      :height="height"
      :tabindex="tabindex"
      :visible="background_visible"
      fill-opacity="1"
      :fill="`url(${gradient_fragment('radial-background')})`"
      @focus="handle_focus('background')" />
    <as-path
      v-if="vector.light"
      :id="query('light')"
      itemprop="light"
      :path="vector.light"
      :tabindex="tabindex"
      :visible="light_visible"
      :mask="`url(${gradient_fragment('horizontal-mask')})`"
      :fill="`url(${gradient_fragment('vertical-light')})`"
      :stroke="`url(${gradient_fragment('horizontal-medium')})`"
      @focus="handle_focus('light')" />
    <as-path
      v-if="vector.regular"
      :id="query('regular')"
      itemprop="regular"
      :path="vector.regular"
      :tabindex="tabindex"
      :visible="regular_visible"
      :mask="`url(${gradient_fragment('radial-mask')})`"
      :fill="`url(${gradient_fragment('horizontal-regular')})`"
      :stroke="`url(${gradient_fragment('vertical-bold')})`"
      @focus="handle_focus('regular')" />
    <as-path
      v-if="vector.medium"
      :id="query('medium')"
      itemprop="medium"
      :path="vector.medium"
      :tabindex="tabindex"
      :visible="medium_visible"
      :mask="`url(${gradient_fragment('vertical-mask')})`"
      :fill="`url(${gradient_fragment('vertical-medium')})`"
      :stroke="`url(${gradient_fragment('vertical-background')})`"
      @focus="handle_focus('medium')" />
    <as-path
      v-if="vector.bold"
      :id="query('bold')"
      itemprop="bold"
      :tabindex="tabindex"
      :path="vector.bold"
      :visible="bold_visible"
      :mask="`url(${gradient_fragment('horizontal-mask')})`"
      :fill="`url(${gradient_fragment('vertical-bold')})`"
      :stroke="`url(${gradient_fragment('radial-light')})`"
      @focus="handle_focus('bold')" />
  </symbol>
</template>
