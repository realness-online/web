<template>
  <Planning v-if="!note_wanted" />
  <iframe v-else-if="framed" :srcdoc="framed" title="Note" />
  <template v-else>
    <header aria-label="Vault"></header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <NoteArticle
      v-else-if="html"
      :html="html"
      :related="related"
      :links="links" />
    <footer v-if="html" aria-label="Note file">
      <code>{{ note_path }}</code>
    </footer>
  </template>
</template>

<script setup>
  import {
    computed,
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref,
    watch
  } from 'vue'
  import { useRoute as use_route } from 'vue-router'
  import NoteArticle from '@/components/note/as-article.vue'
  import Planning from '@/views/Planning.vue'
  import { settled_token } from '@/utils/settled-user'
  import { read_note } from '@/utils/vault-items'
  import { highlight_code, markdown_html } from '@/utils/markdown'
  import { with_attachments } from '@/utils/vault-attachments'
  import { watch_vault } from '@/utils/vault-events'
  import '@/style/mermaid.css'
  import '#root/tools/publish/renderer/static/scripts/diagrams.css'

  const NOT_FOUND = 404
  const html = ref('')
  const framed = ref('')
  const related = ref([])
  const links = ref({})
  const note_path = ref('')
  const error = ref('')
  const loading = ref(false)
  /** @type {string[]} */
  let image_urls = []

  const route = use_route()
  const itemid = computed(() =>
    route.params.itemid ? `/${route.params.itemid}` : ''
  )
  const note_wanted = computed(() => itemid.value !== '')

  const load = async ({ fresh = true } = {}) => {
    const { value } = itemid
    if (fresh) {
      html.value = ''
      framed.value = ''
      related.value = []
    }
    error.value = ''
    if (!value) return
    loading.value = fresh
    try {
      const token = await settled_token()
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
      const note = read_note(await response.text())
      if (!note) {
        error.value = 'The note could not load.'
        return
      }
      note_path.value = note.path
      if (note.layout && note.layout !== 'app') {
        const { framed_note } = await import('@/utils/note-layout')
        framed.value = String(await framed_note(note))
        return
      }
      framed.value = ''
      const shown = await with_attachments(
        await highlight_code(markdown_html(note.text)),
        value,
        token
      )
      image_urls.forEach(url => URL.revokeObjectURL(url))
      image_urls = shown.urls
      html.value = shown.html
      related.value = note.related
      links.value = note.links
    } finally {
      loading.value = false
    }
  }

  const token_for = settled_token

  watch(itemid, load)

  let stop_watching = () => {}

  on_mounted(async () => {
    load()
    stop_watching = await watch_vault(changed => {
      if (note_path.value && changed.endsWith(`/${note_path.value}`))
        load({ fresh: false })
    }, token_for)
  })
  on_unmounted(() => {
    image_urls.forEach(url => URL.revokeObjectURL(url))
    stop_watching()
  })
</script>

<style lang="stylus">
  iframe[title='Note'] {
    position: fixed;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    border: 0;
  }

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

    ~ p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }
  }

  footer[aria-label='Note file'] {
    max-inline-size: 72rem;
    margin-inline: auto;
    padding: var(--base-line);

    > code {
      user-select: text;
      -webkit-user-select: text;
    }
  }

  article[itemtype$='/Article'][aria-label='Note'] {
    max-inline-size: 72rem;
    margin-inline: auto;
    padding-inline: var(--base-line);

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

      > :is(pre, figure) {
        grid-column: 1 / -1;
      }

      > table {
        grid-column: 2 / -1;
        inline-size: fit-content;
        min-inline-size: unquote('min(65ch, 100%)');
        max-inline-size: 100%;
        margin-block: var(--base-line);
        border-collapse: collapse;
        text-align: start;

        th,
        td {
          padding: calc(var(--base-line) / 3) calc(var(--base-line) / 2);
          border-block-end: 1px solid var(--muted-text);
          text-align: start;
          vertical-align: baseline;
          overflow-wrap: anywhere;
        }

        th:first-child,
        td:first-child {
          padding-inline-start: 0;
        }

        th:last-child,
        td:last-child {
          padding-inline-end: 0;
        }

        th {
          font-size: 0.875em;
          font-weight: 400;
          color: var(--muted-text);
        }

        td:first-child {
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875em;
        }

        tbody tr:last-child td {
          border-block-end: 0;
        }

        del {
          text-decoration: none;
        }
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
