<script setup>
  defineProps({
    title: { type: String, required: true },
    html: { type: String, required: true },
    toc: { type: Array, default: () => [] }
  })
</script>

<template>
  <section class="page legal" lang="en">
    <header>
      <h1>{{ title }}</h1>
    </header>
    <article>
      <nav v-if="toc.length" class="toc" aria-label="Table of contents">
        <router-link
          v-for="item in toc"
          :key="item.id"
          :to="`#${item.id}`"
          replace
          :class="`level-${item.level}`">
          {{ item.title }}
        </router-link>
      </nav>
      <section class="content">
        <div class="document" v-html="html" />
      </section>
    </article>
  </section>
</template>

<style lang="stylus">
  @require '../style/mixins/markdown-content.styl'

  section.page.legal {
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
        &:has(nav.toc) {
          display: grid;
          grid-template-columns: (base-line * 9) minmax(0, 1fr);
          gap: base-line * 1.5;
          align-items: start;
        }
      }

      & > nav.toc {
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
          margin: round((base-line / 4), 2) 0;
          color: var(--accent);
          text-decoration: none;
          break-inside: avoid;
          line-height: 1.66;
          transition: color 150ms ease;
          touch-action: manipulation;

          &:hover {
            color: var(--emphasis);
          }

          &.level-3,
          &.level-4 {
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

      &:not(:has(nav.toc)) > section.content {
        margin-inline: auto;

        // The global `p { max-width: var(--page-width) }` rule caps prose
        // width app-wide, but leaves each element block-aligned left — fine
        // in narrow layouts, but it reads as ragged/left-heavy once this
        // column has no sidebar to sit next to. Center each capped element
        // as its own block instead.
        & > div.document {
          p, blockquote, ul, ol {
            margin-inline: auto;
          }

          h1, h2, h3, h4, h5, h6 {
            text-align: center;
          }
        }
      }

      & > section.content {
        min-width: 0;
        padding: 0 base-line * 0.5;
        max-width: base-line * 36;

        & > div.document {
          min-width: 0;
          max-width: 100%;
          markdown_content();
        }
      }
    }
  }
</style>
