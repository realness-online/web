<script setup>
  import LegalPage from '@/components/legal-page.vue'
  import privacy_md from '@/content/privacy.md?raw'
  import { markdown_html, markdown_toc } from '@/utils/markdown'

  defineOptions({ name: 'Privacy' })

  const html = markdown_html(privacy_md)
  const toc = markdown_toc(privacy_md)
</script>

<template>
  <legal-page title="Privacy Policy" :html="html" :toc="toc" />
</template>
