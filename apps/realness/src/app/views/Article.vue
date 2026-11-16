<template>
  <p role="status">{{ message }}</p>
</template>

<script setup>
  import { onMounted as on_mounted, ref } from 'vue'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { settled_token } from '@/utils/settled-user'

  const route = use_route()
  const router = use_router()
  const message = ref('Loading')

  const slug_of = path => path.split('/').pop()?.replace(/\.md$/, '') ?? ''

  on_mounted(async () => {
    const token = await settled_token()
    const response = await fetch('/v1/vault/articles', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) {
      message.value = 'Your articles could not load.'
      return
    }
    const { articles } = await response.json()
    const slug = decodeURIComponent(String(route.params.slug ?? ''))
    const found = (Array.isArray(articles) ? articles : []).find(
      article => slug_of(article.path) === slug
    )
    if (!found) {
      message.value = 'That article is not here.'
      return
    }
    router.replace({ path: '/vault', hash: `#${found.itemid}` })
  })
</script>
