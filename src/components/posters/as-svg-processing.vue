<script setup>
  import {
    ref,
    computed,
    onMounted as mounted,
    inject,
    watchEffect as watch
  } from 'vue'
  import AsSvg from '@/components/posters/as-svg'

  const props = defineProps({
    queue_item: {
      type: Object,
      required: true
    }
  })

  const thumbnail_url = ref('')
  const image_width = ref(0)
  const image_height = ref(0)
  const new_vector = inject('new_vector', ref(null))
  const progress_percent = computed(() =>
    Math.round(props.queue_item.progress || 0)
  )
  const is_processing = computed(() => props.queue_item.status === 'processing')
  const aspect_ratio = computed(() => {
    if (image_width.value && image_height.value)
      return `${image_width.value} / ${image_height.value}`
    return '1 / 1' // fallback to square
  })

  watch(() => {
    if (new_vector.value) {
      image_width.value = new_vector.value.width
      image_height.value = new_vector.value.height
    }
  })

  mounted(() => {
    const { queue_item } = props
    if (queue_item?.resized_blob)
      thumbnail_url.value = URL.createObjectURL(queue_item.resized_blob)
  })
</script>

<template>
  <figure class="poster processing" :style="{ aspectRatio: aspect_ratio }">
    <img
      v-if="thumbnail_url"
      :src="thumbnail_url"
      :width="`${image_width}px`"
      :height="`${image_height}px`" />
    <as-svg
      v-if="is_processing && new_vector"
      :itemid="queue_item.id"
      :sync_poster="new_vector" />

    <figcaption>
      <progress :value="progress_percent" max="100"></progress>
      <span>{{ progress_percent }}%</span>
    </figcaption>
  </figure>
</template>

<style lang="stylus">
  figure.poster.processing {
    position: relative;
    overflow: hidden;
    border-radius: calc(var(--base-line) * 0.25);
    background: var(--black-background);
    & > img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.66;
      z-index: 1;
      filter: grayscale(0.66);
    }
    & > svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2;
      color: var(--green);
    }
    & > figcaption {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 3;
      padding: calc(var(--base-line) * 0.5);
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      gap: calc(var(--base-line) * 0.5);
    }
    & > figcaption progress {
      flex: 1;
      height: calc(var(--base-line) * 0.5);
      accent-color: var(--green);
    }
    & > figcaption span {
      font-size: smaller;
      color: var(--green);
    }
  }
</style>
