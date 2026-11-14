<template>
  <article itemscope itemtype="https://schema.org/Article" :aria-label="label">
    <nav v-if="related.length" aria-label="Related">
      <a v-for="link in related" :key="link.href" :href="link.href">
        {{ link.title }}
      </a>
    </nav>
    <section ref="body" itemprop="articleBody" v-html="html" />
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

  const props = defineProps({
    html: { type: String, required: true },
    related: { type: Array, default: () => [] },
    links: { type: Object, default: () => ({}) },
    label: { type: String, default: 'Note' }
  })

  const body = ref(null)

  /** A body link that names another vault note opens that note, by itemid. */
  const resolve_links = () => {
    for (const link of body.value?.querySelectorAll('a[href]') ?? []) {
      const itemid = props.links[link.getAttribute('href') ?? '']
      if (itemid) link.setAttribute('href', itemid)
    }
  }

  const draw = async () => {
    await next_tick()
    resolve_links()
    mark_diagrams(body.value)
    await draw_diagrams(body.value)
  }

  on_mounted(draw)
  watch(() => props.html, draw)
</script>
