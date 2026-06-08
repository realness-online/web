<script setup>
  import MarketingNav from '@/components/marketing-nav'
  import {
    documentation_html,
    documentation_toc
  } from '@/utils/documentation-content'

  const toc_items = documentation_toc()
  const rendered_html = documentation_html()
</script>

<template>
  <section id="docs" class="page documentation" lang="en">
    <header>
      <marketing-nav />
      <h2>Documentation</h2>
    </header>
    <article>
      <nav v-if="toc_items.length" class="toc" aria-label="Table of contents">
        <a
          v-for="item in toc_items"
          :key="item.id"
          :href="`#${item.id}`"
          :class="`level-${item.level}`">
          {{ item.title }}
        </a>
      </nav>
      <section class="content" v-html="rendered_html" />
    </article>
  </section>
</template>

<style lang="stylus">
  section.page.documentation {
    margin: 0 auto;
    padding: base-line;

    @media (min-width: pad-begins) {
      max-width: base-line * 52;
    }

    & > header {
      display: block;
      padding: 0;
      margin-bottom: base-line * 2;

      h1 {
        margin-top: base-line * 2;
        text-align: center;
        color: var(--blue);

        span {
          font-size: smaller;
        }
      }

      h2 {
        margin-top: 0;
        text-align: center;
        color: var(--red);
      }
    }

    & > article {
      display: block;

      @media (min-width: pad-begins) {
        display: grid;
        grid-template-columns: (base-line * 11) minmax(0, 1fr);
        gap: base-line * 2;
        align-items: start;
      }

      & > nav.toc {
        display: block;
        column-width: 166px;
        column-gap: base-line;
        column-fill: balance;
        column-rule: 1px solid var(--red);
        padding-left: base-line * 1.33;
        margin-bottom: base-line * 2;

        @media (min-width: pad-begins) {
          column-width: auto;
          column-count: 1;
          column-rule: none;
          padding-left: 0;
          padding-right: base-line;
          margin-bottom: 0;
          position: sticky;
          top: base-line;
          max-height: calc(100dvh - base-line * 4);
          overflow-y: auto;
          border-right: 1px solid var(--red);
        }

        & > a {
          display: block;
          font-size: smaller;
          margin: round((base-line / 4), 2) 0;
          color: var(--blue);
          text-decoration: none;
          break-inside: avoid;
          line-height: 1.66;

          &:hover {
            color: var(--red);
          }

          &.level-3 {
            padding-left: base-line * 0.11;
            line-height: 1.33;
            font-size: 0.66em;

            &:before {
              content: '-';
              margin-right: base-line * 0.11;
            }
          }

          &.level-4,
          &.level-5,
          &.level-6 {
            padding-left: base-line * 0.66;
            line-height: 1.33;
            font-size: 0.58em;

            &:before {
              content: '-';
              margin-right: base-line * 0.11;
            }
          }
        }
      }

      & > section.content {
        padding: 0 base-line * 0.5;
        max-width: base-line * 36;

        h1, h2, h3, h4, h5, h6 {
          color: var(--red);
          margin-top: base-line * 2;
          margin-bottom: base-line;

          &:first-child {
            margin-top: 0;
          }
        }

        h1 {
          color: var(--blue);
        }

        p {
          margin-bottom: base-line;
          line-height: 1.6;
        }

        ul, ol {
          margin-bottom: base-line;
          padding-left: base-line * 2;

          li {
            margin-bottom: round((base-line / 2), 2);
          }
        }

        code {
          background: var(--code-surface);
          padding: round((base-line / 4), 2) round((base-line / 2), 2);
          border-radius: round((base-line / 4), 2);
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
        }

        pre {
          background: var(--code-surface);
          padding: base-line;
          border-radius: round((base-line / 4), 2);
          overflow-x: auto;
          margin-bottom: base-line;
        }

        blockquote {
          border-left: 3px solid var(--red);
          padding-left: base-line;
          margin-bottom: base-line;
          font-style: italic;
        }

        a {
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
