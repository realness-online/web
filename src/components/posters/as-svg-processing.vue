<script setup>
  import { ref, computed, onMounted as mounted, inject } from 'vue'
  import AsSvg from '@/components/posters/as-svg'

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
  const status_text = computed(() =>
    is_currently_processing.value ? 'Processing...' : 'Waiting...'
  )

  mounted(() => {
    const { queue_item } = props
    if (queue_item?.resized_blob)
      thumbnail_url.value = URL.createObjectURL(queue_item.resized_blob)
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
      :width="`${image_width}px`"
      :height="`${image_height}px`" />

    <figcaption>
      <span>{{ status_text }}</span>
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
      opacity: 0.66;
      filter: grayscale(1);
      width: auto;
      height: auto;
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
      align-items: center;
      justify-content: center;
    }

    & > figcaption span {
      font-size: smaller;
      color: var(--green);
    }
  }
</style>
