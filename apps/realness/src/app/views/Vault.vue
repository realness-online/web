<template>
  <header aria-label="Vault">
    <hgroup>
      <h1><router-link to="/">Realness</router-link></h1>
      <p>Vault</p>
    </hgroup>
  </header>
  <p v-if="error" role="status">{{ error }}</p>
  <p v-else-if="loading" role="status">Loading</p>
  <NoteArticle
    v-else-if="html"
    :html="html"
    :related="related"
    :links="links" />
</template>

<script setup>
  import {
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref,
    watch
  } from 'vue'
  import NoteArticle from '@/components/note/as-article.vue'
  import { current_user } from '@/utils/serverless'
  import { markdown_html } from '@/utils/markdown'
  import { published_url } from '@/utils/published-url'
  import { watch_vault } from '@/utils/vault-events'
  import '#root/tools/publish/renderer/static/scripts/diagrams.css'

  const NOT_FOUND = 404
  const html = ref('')
  const related = ref([])
  const links = ref({})
  const note_path = ref('')
  const error = ref('')
  const loading = ref(false)

  const settled_user = () => {
    if (current_user.value !== undefined)
      return Promise.resolve(current_user.value)
    return new Promise(resolve => {
      const stop = watch(current_user, user => {
        if (user === undefined) return
        stop()
        resolve(user)
      })
    })
  }

  const value_of_hash = () => {
    try {
      return decodeURIComponent(location.hash.slice(1))
    } catch {
      return ''
    }
  }

  const load = async () => {
    const value = value_of_hash()
    html.value = ''
    related.value = []
    error.value = ''
    if (!value) {
      error.value = 'No note in the link.'
      return
    }
    if (!value.startsWith('/')) {
      error.value = 'That note is not here.'
      return
    }
    const user = await settled_user()
    if (!user) {
      error.value = 'Sign in to open this link.'
      return
    }
    loading.value = true
    try {
      const token = (await current_user.value?.getIdToken()) ?? null
      const response = await fetch(
        `/v1/vault/item?itemid=${encodeURIComponent(value)}`,
        {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        }
      )
      if (response.status === NOT_FOUND) {
        error.value = 'That note is not here.'
        return
      }
      if (!response.ok) {
        error.value = 'The note could not load.'
        return
      }
      const note = await response.json()
      const published = await published_url(note.itemid)
      if (published) {
        location.replace(published)
        return
      }
      note_path.value = note.path
      html.value = markdown_html(note.text)
      related.value = Array.isArray(note.related) ? note.related : []
      links.value = note.links ?? {}
    } finally {
      loading.value = false
    }
  }

  const token_for = async () => (await current_user.value?.getIdToken()) ?? null

  let stop_watching = () => {}

  on_mounted(async () => {
    load()
    addEventListener('hashchange', load)
    stop_watching = await watch_vault(changed => {
      if (note_path.value && changed.endsWith(`/${note_path.value}`)) load()
    }, token_for)
  })
  on_unmounted(() => {
    removeEventListener('hashchange', load)
    stop_watching()
  })
</script>

<style lang="stylus">
  header[aria-label='Vault'] {
    position: sticky;
    inset-block-start: 0;
    z-index: 10;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    max-inline-size: 72rem;
    margin-inline: auto;
    padding: calc(var(--base-line) * 0.5) var(--base-line);
    background: var(--surface);

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

    ~ p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }
  }

  article[itemtype$='/Article'][aria-label='Note'] {
    max-inline-size: 72rem;
    margin-inline: auto;
    padding-inline: var(--base-line);

    > nav {
      display: flex;
      flex-wrap: wrap;
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

    > section {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 65ch) minmax(0, 1fr);
      padding-block: calc(var(--base-line) * 3);
      line-height: 1.6;
      user-select: text;
      -webkit-user-select: text;

      > * {
        grid-column: 2;
      }

      > :is(pre, table, figure) {
        grid-column: 1 / -1;
      }

      p {
        max-width: none;
      }

      tr:has(del) {
        opacity: 0.45;
      }
    }
  }
</style>
