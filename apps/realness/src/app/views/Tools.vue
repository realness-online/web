<template>
  <article
    itemscope
    itemtype="https://schema.org/CollectionPage"
    aria-label="Tools">
    <header>
      <hgroup>
        <h1><router-link to="/">Realness</router-link></h1>
        <p>Tools</p>
      </hgroup>
      <nav aria-label="Related">
        <router-link to="/planning">Plans</router-link>
        <router-link to="/blog">Articles</router-link>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <section v-else-if="pages.length" itemprop="hasPart">
      <ol>
        <li
          v-for="page in pages"
          :key="page.path"
          itemscope
          itemtype="https://schema.org/CreativeWork">
          <router-link :to="`/planning/page#${page.path}`">
            <span itemprop="name">{{ page.title }}</span>
          </router-link>
        </li>
      </ol>
    </section>
    <p v-else role="status">No tool pages yet.</p>
  </article>
</template>

<script setup>
  import { onMounted as on_mounted, ref } from 'vue'
  import { current_user } from '@/utils/serverless'

  const pages = ref([])
  const error = ref('')
  const loading = ref(true)

  on_mounted(async () => {
    const token = (await current_user.value?.getIdToken()) ?? null
    const response = await fetch('/v1/vault/pages', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    loading.value = false
    if (!response.ok) {
      error.value = 'Your tool pages could not load.'
      return
    }
    const payload = await response.json()
    pages.value = Array.isArray(payload.pages) ? payload.pages : []
  })
</script>

<style lang="stylus">
  article[itemtype$='/CollectionPage'][aria-label='Tools'] {
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
        gap: var(--base-line);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      a {
        color: var(--text);
        font-weight: 600;
        text-decoration: none;
        border-block-end: 1px solid var(--muted-text);

        &:hover {
          color: var(--emphasis);
        }
      }
    }
  }
</style>
