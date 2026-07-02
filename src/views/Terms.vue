<script setup>
  import LegalPage from '@/components/legal-page.vue'
  import terms_md from '@/content/terms.md?raw'
  import { markdown_html } from '@/utils/markdown'
  import { terms_toc } from '@/prerender/toc'

  defineOptions({ name: 'Terms' })

  const html = markdown_html(terms_md)
  const toc = terms_toc
</script>

<template>
  <legal-page title="Terms of Service" :html="html" :toc="toc" />
</template>
