<template>
  <iframe
    v-if="own_document"
    :srcdoc="own_document"
    :title="headline || 'Page'" />
  <template v-else>
    <header aria-label="Page">
      <nav aria-label="Related">
        <router-link to="/vault">Vault</router-link>
        <router-link to="/vault/tools">Tools</router-link>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <PageArticle
      v-else
      :html="html"
      :itemtype="itemtype"
      :label="headline || 'Tool page'" />
  </template>
</template>

<script setup>
  import {
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref
  } from 'vue'
  import PageArticle from '@/components/page/as-article.vue'
  import { current_user } from '@/utils/serverless'
  import { watch_vault } from '@/utils/vault-events'
  import { read_note } from '@/utils/vault-items'

  const NOT_FOUND = 404
  const html = ref('')
  const own_document = ref('')
  const itemtype = ref('https://schema.org/TechArticle')
  const headline = ref('')
  const sheets = []
  const error = ref('')
  const loading = ref(false)

  const page_path = () => {
    try {
      return decodeURIComponent(location.hash.slice(1))
    } catch {
      return ''
    }
  }

  const token_for = async () => (await current_user.value?.getIdToken()) ?? null

  const load = async () => {
    const path = page_path()
    html.value = ''
    own_document.value = ''
    error.value = ''
    if (!path) {
      error.value = 'No page in the link.'
      return
    }
    loading.value = true
    try {
      const response = await fetch(
        `/v1/vault/note?path=${encodeURIComponent(path)}`,
        { headers: { authorization: `Bearer ${await token_for()}` } }
      )
      if (response.status === NOT_FOUND) {
        error.value = 'That page is not here.'
        return
      }
      if (!response.ok) {
        error.value = 'The page could not load.'
        return
      }
      const { text } = read_note(await response.text()) ?? { text: '' }
      const page = page_of(text)
      itemtype.value =
        /<html[^>]*itemtype="([^"]+)"/.exec(text)?.[1] ??
        'https://schema.org/TechArticle'
      headline.value =
        page
          .querySelector('[itemprop="headline"], [itemprop="name"]')
          ?.textContent?.trim() ?? ''
      if (/<script[\s>]/i.test(text)) {
        apply_styles([])
        own_document.value = await with_vault_files(text, path)
        return
      }
      html.value = body_of(page)
      apply_styles(await styles_of(text, path))
    } finally {
      loading.value = false
    }
  }

  /**
   * Put the page's own styles in the document, and take them out again when the
   * page closes.
   * @param {string[]} texts
   */
  const apply_styles = texts => {
    for (const sheet of sheets.splice(0)) sheet.remove()
    for (const text of texts) {
      const element = document.createElement('style')
      element.textContent = text
      document.head.append(element)
      sheets.push(element)
    }
  }

  /**
   * The stylesheets the page links that live beside it in the vault, as text.
   * The page keeps its own CSS; the app only carries it over.
   * @param {string} text the page's whole text
   * @param {string} path the page's vault path
   */
  const styles_of = async (text, path) => {
    const token = await token_for()
    const hrefs = [...text.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(
      ([, href]) => href
    )
    const sheets = await Promise.all(
      hrefs.map(href => vault_file(href, path, token))
    )
    return sheets.filter(sheet => sheet !== null)
  }

  /**
   * A file the page links, read from beside it in the vault, or null.
   * @param {string} href
   * @param {string} path the page's vault path
   * @param {string | null} token
   */
  const vault_file = async (href, path, token) => {
    if (/^[a-z]+:/i.test(href)) return null
    const folder = path.split('/').slice(0, -1).join('/')
    const file = `${folder}/${href.replace(/^\/+/, '')}`
    const response = await fetch(
      `/v1/vault/note?path=${encodeURIComponent(file)}`,
      { headers: { authorization: `Bearer ${token}` } }
    )
    return response.ok ? (read_note(await response.text())?.text ?? null) : null
  }

  /**
   * The page with the stylesheets and scripts it keeps in the vault written
   * inline, so its frame needs nothing from the app's origin.
   * @param {string} text the page's whole text
   * @param {string} path the page's vault path
   */
  const with_vault_files = async (text, path) => {
    const token = await token_for()
    const tags = [
      ...text.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g),
      ...text.matchAll(/<script\b[^>]*src="([^"]+\.js)"[^>]*><\/script>/g)
    ]
    const files = await Promise.all(
      tags.map(([, href]) => vault_file(href, path, token))
    )
    return tags.reduce((page, [tag], index) => {
      const file = files[index]
      if (file === null) return page
      const element = document.createElement(
        tag.startsWith('<link') ? 'style' : 'script'
      )
      if (element.localName === 'script') element.type = 'module'
      element.textContent = file
      const inline = element.outerHTML
      return page.replace(tag, () => inline)
    }, text)
  }

  /**
   * The page as a document, with its scripts and stylesheet links removed so
   * nothing loads from the app's own origin.
   * @param {string} text
   */
  const page_of = text =>
    new DOMParser().parseFromString(
      text
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<link\b[^>]*>/g, ''),
      'text/html'
    )

  /** The page's own article body, without the site chrome or its scripts. */
  const body_of = page => {
    const found =
      page.querySelector('section[itemprop="articleBody"]') ??
      page.querySelector('article') ??
      page.querySelector('main')
    return found?.innerHTML.trim() ?? ''
  }

  let stop_watching = () => {}

  on_mounted(async () => {
    load()
    addEventListener('hashchange', load)
    stop_watching = await watch_vault(changed => {
      const path = page_path()
      if (path && changed.endsWith(`/${path}`)) load()
    }, token_for)
  })
  on_unmounted(() => {
    removeEventListener('hashchange', load)
    stop_watching()
    apply_styles([])
  })
</script>

<style lang="stylus">
  iframe {
    position: fixed;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    border: 0;
  }

  header[aria-label='Page'] {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    max-inline-size: 72rem;
    margin-inline: auto;
    padding: calc(var(--base-line) * 0.5) var(--base-line);

    ~ p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }

    ~ article:has(> section[itemprop='articleBody']) {
      max-inline-size: 72rem;
      margin-inline: auto;
      padding-inline: var(--base-line);

      > section {
        padding-block: calc(var(--base-line) * 3);
        line-height: 1.6;

        pre.mermaid {
          overflow-x: auto;
        }
      }
    }
  }
</style>
