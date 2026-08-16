<script setup>
  import LegalPage from '@/components/legal-page.vue'
  import license_md from '@/content/license.md?raw'
  import gpl_text from '../../LICENSE?raw'
  import { markdown_html } from '@/utils/markdown'
  import { license_toc } from '@/prerender/toc'

  defineOptions({ name: 'License' })

  /** @param {string} text */
  const escape_html = text =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')

  const html = [
    markdown_html(license_md),
    `<pre><code>${escape_html(gpl_text)}</code></pre>`
  ].join('\n')
</script>

<template>
  <legal-page title="License" :html="html" :toc="license_toc" />
</template>
