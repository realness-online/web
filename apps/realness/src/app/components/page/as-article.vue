<template>
  <article ref="body" itemscope :itemtype="itemtype" :aria-label="label">
    <section itemprop="articleBody" v-html="html" />
  </article>
</template>

<script setup>
  import {
    nextTick as next_tick,
    onMounted as on_mounted,
    ref,
    watch
  } from 'vue'
  import { draw_diagrams, mark_diagrams } from '@/utils/diagrams'
  import '@/style/mermaid.css'

  const props = defineProps({
    html: { type: String, required: true },
    itemtype: { type: String, default: 'https://schema.org/TechArticle' },
    label: { type: String, default: 'Tool page' }
  })

  const body = ref(null)

  /** A page arrives with its diagram sources; draw them once it is in the document. */
  const draw = async () => {
    await next_tick()
    mark_diagrams(body.value)
    await draw_diagrams(body.value)
  }

  on_mounted(draw)
  watch(() => props.html, draw)
</script>
