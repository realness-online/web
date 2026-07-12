<script setup>
  import LegalPage from '@/components/legal-page.vue'
  import terms_md from '@/content/terms.md?raw'
  import privacy_md from '@/content/privacy.md?raw'
  import { markdown_html } from '@/utils/markdown'
  import { terms_toc, privacy_toc } from '@/prerender/toc'

  defineOptions({ name: 'Terms' })

  // Terms and Privacy live on one page; point their cross-references at
  // in-page anchors instead of the old separate routes.
  const body = [
    '## Terms of Service',
    terms_md.replace(/\(\/privacy\)/g, '(#privacy-policy)'),
    '## Privacy Policy',
    privacy_md.replace(/\(\/terms\)/g, '(#terms-of-service)')
  ].join('\n\n')

  const html = markdown_html(body)
  const toc = [
    { id: 'terms-of-service', title: 'Terms of Service', level: 2 },
    ...terms_toc,
    { id: 'privacy-policy', title: 'Privacy Policy', level: 2 },
    ...privacy_toc
  ]
</script>

<template>
  <legal-page title="Terms &amp; Privacy" :html="html" :toc="toc" />
</template>
