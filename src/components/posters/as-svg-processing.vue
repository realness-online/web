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
  import { as_query_id as query } from '@/utils/itemid'

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
  const image_width = computed(() => props.queue_item.width || 0)
  const image_height = computed(() => props.queue_item.height || 0)
  const landscape = computed(() => {
    if (!image_width.value || !image_height.value) return false
    return image_width.value > image_height.value
  })
  const progress_value = computed(() => props.queue_item.progress || 0)

  mounted(() => {
    const { queue_item } = props
    if (queue_item?.resized_blob)
      thumbnail_url.value = URL.createObjectURL(queue_item.resized_blob)
  })

  unmounted(() => {
    if (thumbnail_url.value) URL.revokeObjectURL(thumbnail_url.value)
  })
</script>

<template>
  <figure class="poster processing" :class="{ landscape }">
    <img
      v-if="thumbnail_url"
      :src="thumbnail_url"
      :width="`${image_width}px`"
      :height="`${image_height}px`" />

    <as-svg
      v-if="is_currently_processing && new_vector"
      :itemid="queue_item.id"
      :sync_poster="new_vector"
      :viewBox="`0 0 ${image_width} ${image_height}`">
      <g
        itemprop="new_cutouts"
        v-if="new_vector.cutout"
        :id="`${queue_item.id}-cutouts-new`"
        :style="{ fillOpacity: '0.5' }">
        <as-path-cutout
          v-for="(cut, index) in new_vector.cutout"
          :key="`cutout-${index}`"
          :cutout="cut"
          :index="index" />
      </g>

      <g v-if="new_vector.cutouts" style="opacity: 0.5">
        <use itemprop="sediment" :href="`#${query(queue_item.id)}-sediment`" />
        <use itemprop="sand" :href="`#${query(queue_item.id)}-sand`" />
        <use itemprop="gravel" :href="`#${query(queue_item.id)}-gravel`" />
        <use itemprop="rock" :href="`#${query(queue_item.id)}-rock`" />
        <use itemprop="boulder" :href="`#${query(queue_item.id)}-boulder`" />
      </g>
    </as-svg>
    <svg style="display: none" v-if="new_vector?.cutouts">
      <symbol
        :id="`${query(queue_item.id)}-sediment`"
        itemscope
        itemtype="/cutouts"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        :itemid="`${queue_item.id}-sediment`"
        v-html="new_vector.cutouts.sediment.innerHTML" />
      <symbol
        :id="`${query(queue_item.id)}-sand`"
        itemscope
        itemtype="/cutouts"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        :itemid="`${queue_item.id}-sand`"
        v-html="new_vector.cutouts.sand.innerHTML" />
      <symbol
        :id="`${query(queue_item.id)}-gravel`"
        itemscope
        itemtype="/cutouts"
        :itemid="`${queue_item.id}-gravel`"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        v-html="new_vector.cutouts.gravel.innerHTML" />
      <symbol
        :id="`${query(queue_item.id)}-rock`"
        itemscope
        itemtype="/cutouts"
        :itemid="`${queue_item.id}-rock`"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        v-html="new_vector.cutouts.rock.innerHTML" />
      <symbol
        :id="`${query(queue_item.id)}-boulder`"
        itemscope
        itemtype="/cutouts"
        :viewBox="`0 0 ${image_width} ${image_height}`"
        :itemid="`${queue_item.id}-boulder`"
        v-html="new_vector.cutouts.boulder.innerHTML" />
    </svg>

    <figcaption>
      <meter
        :value="progress_value || 0"
        min="0"
        max="100"
        low="0"
        high="100"
        optimum="100"
        aria-label="Poster creation progress" />
    </figcaption>
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
