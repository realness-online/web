<template>
  <article
    itemscope
    itemtype="https://schema.org/Article"
    :aria-label="label"
    @click="open_in_app">
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
  import { useRouter as use_router } from 'vue-router'
  import { draw_diagrams, mark_diagrams } from '@/utils/diagrams'

  const props = defineProps({
    html: { type: String, required: true },
    related: { type: Array, default: () => [] },
    links: { type: Object, default: () => ({}) },
    label: { type: String, default: 'Note' }
  })

  const body = ref(null)
  const router = use_router()

  /** A link to another vault note opens it in the app, without a page load. */
  const open_in_app = event => {
    const link = event.target.closest?.('a[href^="/vault/"]')
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    router.push(link.getAttribute('href'))
  }

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

  const summary_of = details =>
    details.querySelector('summary')?.textContent?.trim() ?? ''

  /** A new copy of the same note keeps the details the reader opened. */
  const redraw = async () => {
    const opened = new Set(
      [...(body.value?.querySelectorAll('details[open]') ?? [])].map(summary_of)
    )
    await next_tick()
    for (const details of body.value?.querySelectorAll('details') ?? [])
      if (opened.has(summary_of(details))) details.open = true
    await draw()
  }

  on_mounted(draw)
  watch(() => props.html, redraw, { flush: 'pre' })
</script>
