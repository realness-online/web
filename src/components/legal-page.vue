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
      <a class="page-back" href="#" @click.prevent="$router.back()">← Back</a>
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
        <footer class="legal-links">
          <router-link to="/terms">Terms</router-link>
          <router-link to="/privacy">Privacy</router-link>
          <router-link to="/pricing">Pricing &amp; License</router-link>
        </footer>
      </section>
    </article>
  </section>
</template>

<style lang="stylus">
  @require '../style/mixins/markdown-content.styl'

  section.page.legal {
    margin: 0 auto;
    padding: 0 base-line;

    @media (min-width: pad-begins) {
      max-width: base-line * 52;
    }

    & > header {
      display: block;
      padding: 0;
      margin-bottom: base-line * 2;

      h1 {
        margin-top: base-line;
        text-align: center;
        color: var(--red);
      }

      a.page-back {
        display: block;
        font-size: smaller;
        color: var(--blue);
        text-decoration: none;
        margin-bottom: base-line * 0.5;
        &:hover {
          color: var(--red);
        }
      }
    }

    & > article {
      display: block;

      @media (min-width: pad-begins) {
        display: grid;
        grid-template-columns: (base-line * 9) minmax(0, 1fr);
        gap: base-line * 1.5;
        align-items: start;
      }

      & > nav.toc {
        display: block;
        column-width: base-line * 8;
        column-gap: base-line;
        column-rule: 1px solid var(--red);
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
          border-right: 1px solid var(--red);
        }

        & > a {
          display: block;
          margin: round((base-line / 4), 2) 0;
          color: var(--blue);
          text-decoration: none;
          break-inside: avoid;
          line-height: 1.66;
          transition: color 150ms ease;
          touch-action: manipulation;

          &:hover {
            color: var(--red);
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

      & > section.content {
        min-width: 0;
        padding: 0 base-line * 0.5;
        max-width: base-line * 36;

        & > div.document {
          min-width: 0;
          max-width: 100%;
          markdown_content();
        }

        & > footer.legal-links {
          display: flex;
          flex-wrap: wrap;
          gap: base-line;
          margin-top: base-line * 3;
          padding-top: base-line;
          border-top: 1px solid var(--red);

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
  }
</style>
