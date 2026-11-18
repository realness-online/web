<template>
  <article itemscope itemtype="https://schema.org/Blog" aria-label="Articles">
    <AsBlogHeader />
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <section
      v-else-if="html"
      itemprop="blogPost"
      v-html="html"
      @click="on_index_click" />
    <AsPosterPicker v-if="picking" @pick="on_pick" @close="picking = false" />
    <p v-else role="status">No articles yet.</p>
  </article>
</template>

<script setup>
  import {
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref
  } from 'vue'
  import AsBlogHeader from '@/blog/as-blog-header.vue'
  import AsPosterPicker from '@/components/blog/as-poster-picker.vue'
  import { apply_blog_style, clear_blog_style } from '@/blog/blog-style'
  import { settled_token } from '@/utils/settled-user'
  import { load_blog } from '@/blog/vault-blog'

  const html = ref('')
  const picking = ref(false)
  const error = ref('')
  const loading = ref(true)

  const on_index_click = event => {
    if (event.target.closest('button.pick-poster')) picking.value = true
  }

  const on_pick = () => {
    picking.value = false
  }

  on_mounted(apply_blog_style)
  on_unmounted(clear_blog_style)

  on_mounted(async () => {
    const token = await settled_token()
    const loaded = await load_blog(token).catch(() => null)
    loading.value = false
    if (loaded === null) error.value = 'Your articles could not load.'
    else html.value = loaded
  })
</script>

<style lang="stylus">
  article[itemtype$='/Blog'] {
    > p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }
  }
</style>
