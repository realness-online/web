<template>
  <AsBlogHeader />
  <p v-if="message" role="status">{{ message }}</p>
  <div v-else-if="html" v-html="html" />
</template>

<script setup>
  import {
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref
  } from 'vue'
  import AsBlogHeader from '@/blog/as-blog-header.vue'
  import { apply_blog_style, clear_blog_style } from '@/blog/blog-style'
  import { useRoute as use_route } from 'vue-router'
  import { settled_token } from '@/utils/settled-user'
  import { load_article } from '@/blog/vault-blog'

  const route = use_route()
  const message = ref('Loading')
  const html = ref('')

  on_mounted(apply_blog_style)
  on_unmounted(clear_blog_style)

  on_mounted(async () => {
    const token = await settled_token()
    const slug = decodeURIComponent(String(route.params.slug ?? ''))
    const loaded = await load_article(slug, token).catch(() => undefined)
    if (loaded === undefined) message.value = 'Your article could not load.'
    else if (loaded === null) message.value = 'That article is not here.'
    else {
      message.value = ''
      html.value = loaded
    }
  })
</script>
