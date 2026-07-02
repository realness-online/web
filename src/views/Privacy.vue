<script setup>
  import LegalPage from '@/components/legal-page.vue'
  import privacy_md from '@/content/privacy.md?raw'
  import { markdown_html } from '@/utils/markdown'
  import { privacy_toc } from '@/prerender/toc'

  defineOptions({ name: 'Privacy' })

  const html = markdown_html(privacy_md)
  const toc = privacy_toc
</script>

<template>
  <legal-page title="Privacy Policy" :html="html" :toc="toc" />
</template>
