<script setup>
  import { use as use_poster, is_rect, is_url_query } from '@/use/poster'
  import { ref, onMounted as mounted, computed } from 'vue'
  import css_var from '@/utils/css-var'
  import { use_smil_fade } from '@/use/smil-fade'
  import {
    shadow as shadow_pref,
    mosaic as mosaic_pref,
    stroke as stroke_pref
  } from '@/utils/preference'
  const props = defineProps({
    fill: {
      type: String,
      required: true,
      validator: is_url_query
    },
    rect: {
      type: Object,
      required: false,
      validator: is_rect
    },
    visible: {
      type: Boolean,
      required: false,
      default: true
    }
  })
  const { tabindex } = use_poster(props)
  const fill_value = ref(null)
  mounted(() => {
    fill_value.value = props.fill
    if (props.rect?.style.fill) fill_value.value = props.rect?.style.fill
    if (props.rect?.fill) fill_value.value = props.rect?.fill
  })
  const background_fill = computed(() => {
    // Stroke-only mode wants a neutral ground. Resolve graphite to a literal so
    // downloaded SVGs keep the color outside the app's stylesheet.
    if (!shadow_pref.value && !mosaic_pref.value && stroke_pref.value)
      return css_var('--graphite-lighten').trim()
    return fill_value.value
  })
  // An attribute, not style: the rect sits inside `<symbol>` defs, where CSS
  // transitions never start. SMIL carries the crossing instead.
  const layer_opacity = computed(() => (props.visible ? 1 : 0))
  const layer_fade = ref(null)
  use_smil_fade(layer_fade, () => layer_opacity.value)
</script>

<template>
  <rect
    itemprop="background"
    :fill="background_fill"
    width="100%"
    height="100%"
    :tabindex="tabindex"
    :opacity="layer_opacity"
    :pointer-events="props.visible ? undefined : 'none'">
    <animate
      ref="layer_fade"
      attributeName="opacity"
      begin="indefinite"
      fill="freeze" />
  </rect>
</template>

<style>
  rect[itemprop='background'] {
    outline: none;
    stroke: none;
    transition:
      opacity var(--duration-quick) var(--ease-exit),
      visibility var(--duration-quick) var(--ease-exit);
    &:focus {
      outline: none;
    }
  }

  @starting-style {
    rect[itemprop='background'] {
      opacity: 0;
    }
  }
</style>
