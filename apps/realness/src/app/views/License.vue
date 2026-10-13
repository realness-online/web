<script setup>
  import LegalPage from '@/components/legal-page.vue'
  import AsPromptAgent from '@/components/as-prompt-agent.vue'
  import license_md from '@/content/license.md?raw'
  import gpl_text from '../../../frontend/LICENSE?raw'
  import { markdown_html } from '@/utils/markdown'
  import { license_toc } from '@/prerender/toc'

  defineOptions({ name: 'License' })

  /** @param {string} text */
  const escape_html = text =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')

  const html = markdown_html(license_md)
  const gpl_html = `<pre><code>${escape_html(gpl_text)}</code></pre>`
</script>

<template>
  <legal-page title="License" :html="html" :toc="license_toc">
    <as-prompt-agent />
    <section itemprop="content" v-html="gpl_html" />
  </legal-page>
</template>
