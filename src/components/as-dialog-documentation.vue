<script setup>
  import Icon from '@/components/icon'
  import { ref, computed, onMounted as mounted } from 'vue'
  import { marked } from 'marked'
  import { gfmHeadingId } from 'marked-gfm-heading-id'
  import DOMPurify from 'dompurify'

  const dialog = ref(null)
  const toc_items = ref([])
  const rendered_content = ref('')
  const current_file = ref('documentation')

  const show_modal = () => {
    if (!dialog.value) return
    if (dialog.value.open) dialog.value.close()
    else dialog.value.showModal()
  }

  const handle_click = event => {
    if (event.target === dialog.value) dialog.value.close()
  }

  const scroll_to_section = id => {
    const element = document.getElementById(id)
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }

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
  const load_markdown_content = async filename => {
    const response = await fetch(`/src/content/${filename}`)
    if (!response.ok)
      throw new Error(`Failed to load ${filename}: ${response.status}`)

    const content = await response.text()

    current_file.value = filename.replace('.md', '')

    toc_items.value = generate_toc_from_markdown(content)

    marked.use(gfmHeadingId())

    const rendered = await marked.parse(content)
    const sanitized = DOMPurify.sanitize(rendered)

    rendered_content.value = sanitized
  }

  mounted(() => load_markdown_content('documentation.md'))

  defineExpose({ show: show_modal })
</script>

<template>
  <dialog ref="dialog" class="documentation" @click="handle_click">
    <header>
      <h1>Realness.<span>online</span></h1>
      <h2>Documentation</h2>
    </header>
    <article>
      <nav v-if="toc_items.length > 0" class="toc">
        <a
          v-for="item in toc_items"
          :key="item.id"
          :href="`#${item.id}`"
          :class="`level-${item.level}`"
          @click="scroll_to_section(item.id)">
          {{ item.title }}
        </a>
      </nav>
      <section class="content" v-html="rendered_content" />
    </article>
  </dialog>
</template>

<style lang="stylus">
  dialog.documentation {
    & > header {
      h1 {
        margin-top: base-line* 2;
        margin-right: base-line;
        text-align: center;
        color: blue;
        span {
          font-size: smaller;
          color: green;
        }
      }
      h2 {
        text-align: center;
        color: red;
      }
    }
    & > article {
      max-width: var(--page-width);
      max-height: 80vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background-color: var(--black-background);
      &:focus {
        outline: none;
      }
      & > header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: base-line;
        h1 {
          color: var(--red);
        }
        & > a {
          cursor: pointer;
          & > svg.remove {
            fill: var(--white-text);
            width: base-line;
            height: base-line;
            &:hover {
              fill: var(--red);
            }
          }
        }
      }

      & > nav.toc {
        display: block;
        column-width: 166px;
        column-gap: base-line;
        column-fill: balance;
        column-rule: 1px solid var(--red);
        padding-left: base-line * 1.33;
        margin-bottom: base-line * 2;
        & > a {
          display: block;
          font-size: smaller;
          margin: round((base-line / 4), 2) 0;
          color: var(--blue);
          text-decoration: none;
          break-inside: avoid;
          line-height: 1.66;
          text-align: left;

          &:hover {
            color: var(--red);
          }

          // Level 3 and deeper get indentation
          &.level-3 {
            padding-left: base-line * 0.11;
            line-height: 1.33;
            font-size: 0.66em;
            &:before {
              content: '-';
              margin-right: base-line * 0.11;
            }
          }

          &.level-4 {
            padding-left: base-line * 0.66;
            font-size: 0.85em;
          }

          &.level-5 {
            padding-left: base-line * 0.66;
            font-size: 0.8em;
          }

          &.level-6 {
            padding-left: base-line * 0.66;
            font-size: 0.75em;
          }
        }
      }

      & > section.content {
        flex: 1;
        padding: 0 base-line * .5;
        & > h1, & > h2, & > h3, & > h4, & > h5, & > h6 {
          color: var(--red);
          margin-top: base-line * 2;
          margin-bottom: base-line;
          &:first-child {
            margin-top: 0;
          }
        }
        & > h1 {
          color: var(--blue);
          & > span {
            color: var(--green);
            font-size: 0.66em;
            font-weight: 300;
          }
        }
        & > p {
          margin-bottom: base-line;
          line-height: 1.6;
        }

        & > ul, & > ol {
          margin-bottom: base-line;
          padding-left: base-line * 2;

          & > li {
            margin-bottom: round((base-line / 2), 2);
          }
        }

        & > code {
          background: var(--black-background);
          padding: round((base-line / 4), 2) round((base-line / 2), 2);
          border-radius: round((base-line / 4), 2);
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
        }

        & > pre {
          background: var(--black-background);
          padding: base-line;
          border-radius: round((base-line / 4), 2);
          overflow-x: auto;
          margin-bottom: base-line;

          & > code {
            background: none;
            padding: 0;
          }
        }

        & > blockquote {
          border-left: 3px solid var(--red);
          padding-left: base-line;
          margin-bottom: base-line;
          font-style: italic;
        }

        & > a {
          color: var(--blue);
          text-decoration: none;

          &:hover {
            color: var(--red);
          }
        }
      }
    }
  }
</style>
