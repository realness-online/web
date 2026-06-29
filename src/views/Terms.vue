<script setup>
  import LegalPage from '@/components/legal-page.vue'
  import terms_md from '@/content/terms.md?raw'
  import { markdown_html, markdown_toc } from '@/utils/markdown'

  defineOptions({ name: 'Terms' })

  const html = markdown_html(terms_md)
  const toc = markdown_toc(terms_md)
</script>

<template>
  <legal-page title="Terms of Service" :html="html" :toc="toc" />
</template>
