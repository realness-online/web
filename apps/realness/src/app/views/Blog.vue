<template>
  <article
    ref="body"
    itemscope
    itemtype="https://schema.org/Blog"
    aria-label="Articles">
    <header>
      <hgroup>
        <h1><router-link to="/">Realness</router-link></h1>
        <p>Articles</p>
      </hgroup>
      <nav aria-label="Sections">
        <router-link to="/planning">Planning</router-link>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <section v-else-if="articles.length" itemprop="blogPost">
      <ol>
        <PostingArticle
          v-for="article in articles"
          :key="article.itemid"
          :posting="article" />
      </ol>
    </section>
    <p v-else role="status">No articles yet.</p>
  </article>
</template>

<script setup>
  import { onMounted as on_mounted, ref } from 'vue'
  import PostingArticle from '@/components/posting/as-article.vue'
  import { current_user } from '@/utils/serverless'

  const articles = ref([])
  const error = ref('')
  const loading = ref(true)

  on_mounted(async () => {
    const token = (await current_user.value?.getIdToken()) ?? null
    const response = await fetch('/v1/vault/articles', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    loading.value = false
    if (!response.ok) {
      error.value = 'Your articles could not load.'
      return
    }
    const payload = await response.json()
    articles.value = Array.isArray(payload.articles) ? payload.articles : []
  })
</script>

<style lang="stylus">
  article[itemtype$='/Blog'] {
    max-inline-size: 72rem;
    margin-inline: auto;
    padding-inline: var(--base-line);

    > header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-block: calc(var(--base-line) * 0.5);

      hgroup {
        display: flex;
        align-items: baseline;
        gap: calc(var(--base-line) * 0.5);
      }

      h1 {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;

        a {
          color: var(--text);
          text-decoration: none;
        }
      }

      p {
        margin: 0;
        color: var(--muted-text);
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      nav {
        display: flex;
        gap: calc(var(--base-line) * 0.5);
        font-size: 0.75rem;

        a {
          color: var(--accent);
          text-decoration: none;

          &:hover {
            color: var(--emphasis);
          }
        }
      }
    }

    > p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }

    > section {
      padding-block: calc(var(--base-line) * 2);

      ol {
        display: grid;
        gap: calc(var(--base-line) * 1.5);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: baseline;
        gap: calc(var(--base-line) * 0.5) var(--base-line);

        a {
          color: var(--text);
          font-weight: 600;
          text-decoration: none;
          border-block-end: 1px solid var(--muted-text);

          &:hover {
            color: var(--emphasis);
          }
        }

        time {
          color: var(--muted-text);
          font-size: 0.75rem;
          text-transform: uppercase;
        }

        p {
          grid-column: 1 / -1;
          max-inline-size: 65ch;
          margin: 0;
          color: var(--muted-text);
        }
      }
    }
  }
</style>
