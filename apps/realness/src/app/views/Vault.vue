<template>
  <article itemscope itemtype="https://schema.org/Article" aria-label="Note">
    <header>
      <hgroup>
        <h1><router-link to="/">Realness</router-link></h1>
        <p>Vault</p>
      </hgroup>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <section v-if="html" itemprop="articleBody" ref="body" v-html="html" />
  </article>
</template>

<script setup>
  import {
    nextTick as next_tick,
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref,
    watch
  } from 'vue'
  import { current_user } from '@/utils/serverless'
  import { markdown_html } from '@/utils/markdown'
  import { published_url } from '@/utils/published-url'
  import '#root/tools/publish/renderer/static/scripts/diagrams.css'

  const NOT_FOUND = 404
  const body = ref(null)
  const html = ref('')
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

  /** Diagrams draw after the Markdown lands; Pele loads only on a note with one. */
  const draw_diagrams = async () => {
    const codes = [
      ...(body.value?.querySelectorAll('pre > code.language-mermaid') ?? [])
    ]
    if (!codes.length) return
    for (const code of codes) {
      const pre = code.parentElement
      if (!pre) continue
      pre.className = 'mermaid'
      pre.textContent = code.textContent
    }
    const blocks = [...(body.value?.querySelectorAll('pre.mermaid') ?? [])]
    const [{ draw_diagrams: draw }, { size_diagrams }, pele] =
      await Promise.all([
        import('#root/tools/publish/renderer/static/scripts/parts.js'),
        import('#root/tools/publish/renderer/static/scripts/plan-diagrams.js'),
        import('pele')
      ])
    await draw(blocks, () => Promise.resolve(pele))
    size_diagrams(blocks)
  }

  const load = async () => {
    const value = value_of_hash()
    html.value = ''
    error.value = ''
    if (!value) {
      error.value = 'No note in the link.'
      return
    }
    const public_link = !value.startsWith('/')
    if (!public_link) {
      const user = await settled_user()
      if (!user) {
        error.value = 'Sign in to open this link.'
        return
      }
    }
    loading.value = true
    try {
      const query = public_link
        ? `key=${encodeURIComponent(value)}`
        : `itemid=${encodeURIComponent(value)}`
      const token = (await current_user.value?.getIdToken()) ?? null
      const response = await fetch(`/v1/vault/find?${query}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      })
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
      html.value = markdown_html(note.text)
      await next_tick()
      await draw_diagrams()
    } finally {
      loading.value = false
    }
  }

  on_mounted(() => {
    load()
    addEventListener('hashchange', load)
  })
  on_unmounted(() => removeEventListener('hashchange', load))
</script>

<style lang="stylus">
  article[itemtype$='/Article'] {
    max-inline-size: 72rem;
    margin-inline: auto;
    padding-inline: var(--base-line);

    > header {
      position: sticky;
      inset-block-start: 0;
      z-index: 10;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-block: calc(var(--base-line) * 0.5);
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
    }

    > p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
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

    }
  }
</style>
