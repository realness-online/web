<script setup>
  /* eslint-disable vue/no-v-html */
  /* eslint-disable vue/no-static-inline-styles */
  import {
    ref,
    computed,
    onMounted as mounted,
    onUnmounted as unmounted,
    inject
  } from 'vue'
  import Icon from '@/components/icon'
  import AsSvg from '@/components/posters/as-svg'
  import AsPathCutout from '@/components/posters/as-path-cutout'
  import AsSymbolShadow from '@/components/posters/as-symbol-shadow'
  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import {
    as_query_id as query,
    as_fragment_id,
    as_layer_id
  } from '@/utils/itemid'

  const props = defineProps({
    queue_item: {
      type: Object,
      required: true
    }
  })

  const thumbnail_url = ref('')
  const new_vector = inject('new_vector', ref(null))
  const current_processing = inject('current_processing', ref(null))
  const is_processing = computed(() => props.queue_item.status === 'processing')
  const is_currently_processing = computed(
    () =>
      is_processing.value &&
      current_processing.value?.id === props.queue_item.id
  )
  const show_processing_svg = computed(
    () =>
      is_currently_processing.value &&
      new_vector.value &&
      !new_vector.value.optimized
  )
  const show_save_svg = computed(
    () => is_currently_processing.value && new_vector.value?.optimized
  )
  const image_width = computed(() => props.queue_item.width || 0)
  const image_height = computed(() => props.queue_item.height || 0)
  const landscape = computed(() => {
    if (!image_width.value || !image_height.value) return false
    return image_width.value > image_height.value
  })

  mounted(() => {
    const { queue_item } = props
    if (queue_item?.resized_blob) {
      const blob =
        queue_item.resized_blob instanceof ArrayBuffer
          ? new Blob([queue_item.resized_blob], { type: 'image/jpeg' })
          : queue_item.resized_blob
      thumbnail_url.value = URL.createObjectURL(blob)
    }
  })

  unmounted(() => {
    if (thumbnail_url.value) URL.revokeObjectURL(thumbnail_url.value)
  })

  const fragment = suffix => `${as_fragment_id(props.queue_item.id)}-${suffix}`
  const queue_itemid = computed(
    () => props.queue_item.itemid || props.queue_item.id
  )
</script>

<template>
  <figure
    class="poster processing"
    :class="{ landscape, currently_processing: is_currently_processing }">
    <img
      v-if="thumbnail_url"
      :src="thumbnail_url"
      :width="`${image_width}px`"
      :height="`${image_height}px`" />
    <icon name="working" />

    <as-svg
      v-if="show_processing_svg"
      :itemid="queue_itemid"
      :sync_poster="new_vector"
      :viewBox="`0 0 ${image_width} ${image_height}`">
      <as-background
        :id="`${query(queue_item.id)}-background`"
        :rect="new_vector.background"
        :fill="`url(${fragment('radial-background')})`" />
      <as-path
        v-if="new_vector.light"
        :id="`${query(queue_item.id)}-light`"
        itemprop="light"
        :path="new_vector.light"
        :mask="`url(${fragment('horizontal-mask')})`"
        :fill="`url(${fragment('vertical-light')})`"
        :stroke="`url(${fragment('horizontal-medium')})`" />
      <as-path
        v-if="new_vector.regular"
        :id="`${query(queue_item.id)}-regular`"
        itemprop="regular"
        :path="new_vector.regular"
        :mask="`url(${fragment('radial-mask')})`"
        :fill="`url(${fragment('horizontal-regular')})`"
        :stroke="`url(${fragment('vertical-bold')})`" />
      <as-path
        v-if="new_vector.medium"
        :id="`${query(queue_item.id)}-medium`"
        itemprop="medium"
        :path="new_vector.medium"
        :mask="`url(${fragment('vertical-mask')})`"
        :fill="`url(${fragment('vertical-medium')})`"
        :stroke="`url(${fragment('vertical-background')})`" />
      <as-path
        v-if="new_vector.bold"
        :id="`${query(queue_item.id)}-bold`"
        itemprop="bold"
        :path="new_vector.bold"
        :mask="`url(${fragment('horizontal-mask')})`"
        :fill="`url(${fragment('vertical-bold')})`"
        :stroke="`url(${fragment('radial-light')})`" />
      <g itemprop="new_cutouts" v-if="new_vector.cutout" fill-opacity="0.5">
        <as-path-cutout
          v-for="(cut, index) in new_vector.cutout"
          :key="`cutout-${index}`"
          :cutout="cut"
          :index="index" />
      </g>
    </as-svg>

    <as-svg
      v-if="show_save_svg"
      :itemid="queue_itemid"
      :sync_poster="new_vector"
      :viewBox="`0 0 ${image_width} ${image_height}`" />

    <svg style="display: none; content-visibility: hidden">
      <defs>
        <as-symbol-shadow />
        <symbol
          :id="query(as_layer_id(queue_itemid, 'sediment'))"
          :itemid="as_layer_id(queue_itemid, 'sediment')"
          itemscope
          itemtype="/cutouts"
          :viewBox="`0 0 ${image_width} ${image_height}`"
          v-html="new_vector?.cutouts?.sediment?.innerHTML ?? ''" />
        <symbol
          :id="query(as_layer_id(queue_itemid, 'sand'))"
          :itemid="as_layer_id(queue_itemid, 'sand')"
          itemscope
          itemtype="/cutouts"
          :viewBox="`0 0 ${image_width} ${image_height}`"
          v-html="new_vector?.cutouts?.sand?.innerHTML ?? ''" />
        <symbol
          :id="query(as_layer_id(queue_itemid, 'gravel'))"
          :itemid="as_layer_id(queue_itemid, 'gravel')"
          itemscope
          itemtype="/cutouts"
          :viewBox="`0 0 ${image_width} ${image_height}`"
          v-html="new_vector?.cutouts?.gravel?.innerHTML ?? ''" />
        <symbol
          :id="query(as_layer_id(queue_itemid, 'rocks'))"
          :itemid="as_layer_id(queue_itemid, 'rocks')"
          itemscope
          itemtype="/cutouts"
          :viewBox="`0 0 ${image_width} ${image_height}`"
          v-html="new_vector?.cutouts?.rocks?.innerHTML ?? ''" />
        <symbol
          :id="query(as_layer_id(queue_itemid, 'boulders'))"
          :itemid="as_layer_id(queue_itemid, 'boulders')"
          itemscope
          itemtype="/cutouts"
          :viewBox="`0 0 ${image_width} ${image_height}`"
          v-html="new_vector?.cutouts?.boulders?.innerHTML ?? ''" />
      </defs>
    </svg>
  </figure>
</template>

<style lang="stylus">
  figure.poster.processing {
    display: grid;
    grid-template-areas: "overlay";
    grid-template-rows: auto;
    grid-template-columns: auto;
    border-radius: calc(var(--base-line) * 0.25);
    background: var(--black-background);
    width: fit-content;
    height: fit-content;
    grid-row-start: span 2;
    outline: 1px solid var(--green);

    & > img {
      grid-area: overlay;
      opacity: 0.33;
      filter: grayscale(0.5);
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    & > svg.icon {
      grid-area: overlay;
      width: base-line * 6;
      height: base-line * 2;
      color: var(--green);
      pointer-events: none;
      z-index: 3;
      opacity: 1;
      transition: opacity 0.4s ease-in;
      animation: working-pulse 1.5s ease-in-out infinite;
      @starting-style {
        opacity: 0;
      }
    }
    & > svg:not(.icon) {
      grid-area: overlay;
      color: var(--green);
      pointer-events: none;
      z-index: 3;
    }

    @media (orientation: landscape), (min-width: page-width) {
      &.landscape {
        grid-column-start: span 2;
      }
    }
  }
</style>
