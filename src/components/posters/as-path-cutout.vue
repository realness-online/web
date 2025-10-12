<script setup>
  import {
    ref,
    watchEffect as watch_effect,
    onMounted as mounted,
    inject
  } from 'vue'

  const props = defineProps({
    cutout: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    tabindex: {
      type: Number,
      required: false
    },
    hovered: {
      type: Boolean,
      required: false,
      default: false
    }
  })

  defineEmits(['focus', 'touchstart', 'touchend'])

  const new_poster = ref(inject('new-poster', false))
  const vector = inject('vector', ref(null))

  const path = ref(null)
  const d = ref(undefined)
  const fill = ref(undefined)
  const fill_opacity = ref('0.5')
  const transform = ref(undefined)
  const data_progress = ref(undefined)

  mounted(() => {
    if (props.cutout && typeof props.cutout.getAttribute === 'function') {
      d.value = props.cutout.getAttribute('d')
      fill.value = props.cutout.getAttribute('fill')
      fill_opacity.value = props.cutout.getAttribute('fill-opacity') || '0.5'

      transform.value = props.cutout.getAttribute('transform')
      data_progress.value = props.cutout.dataset.progress || 0
    }
  })

  watch_effect(() => {
    if (props.cutout && typeof props.cutout.getAttribute === 'function')
      d.value = props.cutout.getAttribute('d')
  })
  watch_effect(() => {
    if (vector.value?.optimized) transform.value = undefined
  })
</script>

<template>
  <path
    ref="path"
    :d="d"
    itemprop="cutout"
    :fill="fill"
    :transform="transform"
    :data-progress="data_progress"
    @focus="$emit('focus', 'cutout')"
    @touchstart.passive="$emit('touchstart', $event, props.index)"
    @touchend.passive="$emit('touchend', $event)" />
</template>

<style>
  path[itemprop='cutout'] {
    filter: brightness(1) saturate(1);
    animation-play-state: paused;
    will-change: fill-opacity;
    transition: fill-opacity ease-out 0.8s;
    &:focus {
      outline: none;
    }
    &:hover {
      animation: fade-back ease-out 0.4s 1s forwards;
      animation-iteration-count: 1;
      fill-opacity: 0.75;
    }
    &:active {
      filter: brightness(1.1) saturate(1.1);
      opacity: 0.9;
    }
  }
  @keyframes fade-back {
    to {
      fill-opacity: 0.5;
    }
  }
</style>
