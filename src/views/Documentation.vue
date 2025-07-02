<script setup>
  /** @typedef {import('@/types').Available_Command} Available_Command */
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import { inject, computed, ref, onMounted as mounted } from 'vue'
  import { marked } from 'marked'
  import { gfmHeadingId } from 'marked-gfm-heading-id'
  import DOMPurify from 'dompurify'

  console.info('views:documentation')

  const key_commands = inject('key-commands')

  if (!key_commands) console.warn('key-commands not found in injection')

  const toc_items = ref([])
  const rendered_content = ref('')
  const current_file = ref('documentation')

  // Get available commands for current contexts
  const available_commands = computed(() => {
    const commands = key_commands.get_available_commands.value
    console.log('Available commands:', commands)
    return commands
  })

  // Scroll to section
  const scroll_to_section = id => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Generate TOC from markdown headings
  const generate_toc_from_markdown = content => {
    const lines = content.split('\n')
    const toc = []

    lines.forEach((line, index) => {
      const heading_match = line.match(/^(#{2,6})\s+(.+)$/)
      if (heading_match) {
        const level = heading_match[1].length
        const title = heading_match[2].trim()
        const title_str = String(title || '')
        const id = title_str
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')

        toc.push({ id, title: title_str, level })
      }
    })

    return toc
  }

  // Load markdown content
  const load_markdown_content = async filename => {
    try {
      const response = await fetch(`/src/content/${filename}`)
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}: ${response.status}`)
      }
      const content = await response.text()

      console.log(
        'Raw markdown content (first 200 chars):',
        content.substring(0, 200)
      )
      console.log('Content type:', typeof content)

      // Update current file
      current_file.value = filename.replace('.md', '')

      // Generate TOC
      toc_items.value = generate_toc_from_markdown(content)

      // Configure marked with GitHub-style heading IDs
      marked.use(gfmHeadingId())

      // Render markdown content and sanitize
      const rendered = await marked.parse(content)
      const sanitized = DOMPurify.sanitize(rendered)

      console.log(
        'Rendered content (first 200 chars):',
        sanitized.substring(0, 200)
      )
      console.log('Rendered type:', typeof sanitized)
      console.log('Rendered content:', sanitized)

      rendered_content.value = sanitized
    } catch (error) {
      console.error('Failed to load markdown content:', error)
      // Fallback to basic content
      rendered_content.value =
        '<h1>Content Loading Failed</h1><p>Unable to load the requested documentation file.</p>'
      toc_items.value = []
    }
  }

  mounted(() => load_markdown_content('documentation.md'))
</script>

<template>
  <section id="documentation" class="page">
    <header>
      <logo-as-link />
      <nav v-if="toc_items.length > 0">
        <a
          v-for="item in toc_items"
          :key="item.id"
          :href="`#${item.id}`">
          {{ item.title }}
        </a>
      </nav>
    </header>
    <article v-html="rendered_content" />
  </section>
</template>

<style lang="stylus">
  section#documentation {
    display: flex;
    align-items: flex-start;
    & > header {

      display: flex;
      flex-direction: column;
      gap: base-line;
      align-items: flex-start;
      & > nav {
        height: 100%;
        position: sticky;
        top: 0;
        & > a {
          font-size: smaller;
          display: block;
          margin: base-line * 0.25 0;
        }
      }
    }

    & > article {
      margin-top: base-line * 3;
      align-self: stretch;
    }
  }
</style>
