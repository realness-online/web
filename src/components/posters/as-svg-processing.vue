<script setup>
  /* eslint-disable vue/no-v-html */
  import {
    ref,
    computed,
    onMounted as mounted,
    onUnmounted as unmounted,
    inject
  } from 'vue'
  import AsSvg from '@/components/posters/as-svg'
  import AsPathCutout from '@/components/posters/as-path-cutout'
  import AsPattern from '@/components/posters/as-pattern'
  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import { as_query_id as query, as_fragment_id } from '@/utils/itemid'

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
    () => is_currently_processing.value && new_vector.value && !new_vector.value.optimized
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
    if (queue_item?.resized_blob)
      thumbnail_url.value = URL.createObjectURL(queue_item.resized_blob)
  })

  unmounted(() => {
    if (thumbnail_url.value) URL.revokeObjectURL(thumbnail_url.value)
  })

  const fragment = suffix => `${as_fragment_id(props.queue_item.id)}-${suffix}`
  const queue_itemid = computed(() => props.queue_item.itemid || props.queue_item.id)
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

    <svg style="display: none">
      <as-pattern />
      <symbol
        :id="`${query(queue_item.id)}-sediment`"
        :itemid="`${queue_itemid}/sediment`"
        itemscope
        itemtype="/cutouts"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        v-html="new_vector?.cutouts?.sediment?.innerHTML" />
      <symbol
        :id="`${query(queue_item.id)}-sand`"
        :itemid="`${queue_itemid}/sand`"
        itemscope
        itemtype="/cutouts"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        v-html="new_vector?.cutouts?.sand?.innerHTML" />
      <symbol
        :id="`${query(queue_item.id)}-gravel`"
        :itemid="`${queue_itemid}/gravel`"
        itemscope
        itemtype="/cutouts"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        v-html="new_vector?.cutouts?.gravel?.innerHTML" />
      <symbol
        :id="`${query(queue_item.id)}-rock`"
        :itemid="`${queue_itemid}/rock`"
        itemscope
        itemtype="/cutouts"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        v-html="new_vector?.cutouts?.rock?.innerHTML" />
      <symbol
        :id="`${query(queue_item.id)}-boulder`"
        :itemid="`${queue_itemid}/boulder`"
        itemscope
        itemtype="/cutouts"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        v-html="new_vector?.cutouts?.boulder?.innerHTML" />
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
    @media (orientation: landscape), (min-width: page-width) {
      &.landscape {
        grid-column-start: span 2;
      }
    }
    & > img {
      grid-area: overlay;
      opacity: 0.33;
      filter: grayscale(0.5);
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    & > svg {
      grid-area: overlay;
      color: var(--green);
      pointer-events: none;
    }

    & > figcaption {
      grid-area: overlay;
      align-self: end;
      z-index: 3;
      padding: calc(var(--base-line) * 0.5);
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: calc(var(--base-line) * 0.25);
    }

    & > figcaption span {
      font-size: smaller;
      color: var(--green);
    }

    & > figcaption meter {
      display: block;
      width: 100%;
      height: 12px;
      -webkit-appearance: none;
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.3);
      overflow: hidden;

      &::-webkit-meter-bar {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
      }

      &::-webkit-meter-optimum-value {
        background: var(--green);
        border-radius: 6px;
        transition: width 0.2s linear;
      }

      &::-moz-meter-bar {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
      }

      &::-moz-meter-optimum::-moz-meter-bar {
        background: var(--green);
        border-radius: 6px;
      }
    }
  }
</style>
