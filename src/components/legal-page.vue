<script setup>
  defineProps({
    title: { type: String, required: true },
    html: { type: String, required: true },
    toc: { type: Array, default: () => [] }
  })
</script>

<template>
  <section data-page itemscope itemtype="/legal" lang="en">
    <header>
      <h1>{{ title }}</h1>
    </header>
    <article>
      <nav v-if="toc.length" aria-label="Table of contents">
        <router-link
          v-for="item in toc"
          :key="item.id"
          :to="`#${item.id}`"
          replace
          :data-level="item.level">
          {{ item.title }}
        </router-link>
      </nav>
      <section itemprop="content" v-html="html" />
    </article>
  </section>
</template>

<style lang="stylus">
  section[itemtype='/legal'] {
    margin: 0 auto;
    padding: 0 base-line;
    max-width: support-page-width;

    & > header {
      display: block;
      padding: 0;
      margin-bottom: base-line * 2;

      h1 {
        margin-top: base-line;
        text-align: center;
        color: var(--emphasis);
      }
    }

    & > article {
      display: block;

      @media (min-width: pad-begins) {
        &:has(nav[aria-label='Table of contents']) {
          display: grid;
          grid-template-columns: (base-line * 9) minmax(0, 1fr);
          gap: base-line * 1.5;
          align-items: start;
        }
      }

      & > nav[aria-label='Table of contents'] {
        display: block;
        column-width: base-line * 8;
        column-gap: base-line;
        column-rule: 1px solid var(--emphasis);
        margin-bottom: base-line * 2;

        @media (min-width: pad-begins) {
          column-width: auto;
          column-count: 1;
          column-rule: none;
          padding-right: base-line * 0.75;
          margin-bottom: 0;
          position: sticky;
          top: base-line;
          max-height: calc(100dvh - var(--base-line) * 4);
          overflow-y: auto;
          border-right: 1px solid var(--emphasis);
        }

        & > a {
          display: block;
          color: var(--accent);
          text-decoration: none;
          break-inside: avoid;
          line-height: 1.66;
          transition: color 150ms ease;
          touch-action: manipulation;

          &:hover {
            color: var(--emphasis);
          }

          &[data-level='3'],
          &[data-level='4'] {
            padding-left: base-line * 0.66;
            line-height: 1.33;
            font-size: smaller;

            &:before {
              content: '-';
              margin-right: base-line * 0.11;
            }
          }
        }
      }

      &:not(:has(nav[aria-label='Table of contents'])) > section[itemprop='content'] {
        margin-inline: auto;

        // The global `p { max-width: var(--page-width) }` rule caps prose
        // width app-wide, but leaves each element block-aligned left — fine
        // in narrow layouts, but it reads as ragged/left-heavy once this
        // column has no sidebar to sit next to. Center each capped element
        // as its own block instead.
        p, blockquote, ul, ol {
          margin-inline: auto;
        }

        h1, h2, h3, h4, h5, h6 {
          text-align: center;
        }
      }

      & > section[itemprop='content'] {
        min-width: 0;
        padding-inline: base-line * 0.5;
        max-width: base-line * 36;
      }
    }
  }
</style>
