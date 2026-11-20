<template>
  <article
    itemscope
    itemtype="https://schema.org/CollectionPage"
    aria-label="Artifacts">
    <header aria-label="Artifacts">
      <nav aria-label="Related">
        <router-link to="/vault">Vault</router-link>
        <router-link to="/vault">Vault</router-link>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <template v-else>
      <p aria-label="Folder">
        <button type="button" :disabled="!folder" @click="up">Up</button>
        <code>{{ folder || 'artifacts' }}</code>
      </p>
      <ArtifactList v-if="files.length" :files="files" @open="open" />
      <p v-else role="status">This folder is empty.</p>
      <section v-if="shown" aria-label="File">
        <h2>{{ shown.path }}</h2>
        <pre><code>{{ shown.text }}</code></pre>
      </section>
    </template>
  </article>
</template>

<script setup>
  import { computed, onMounted as on_mounted, ref } from 'vue'
  import ArtifactList from '@/components/artifact/as-list.vue'
  import { current_user } from '@/utils/serverless'

  const files = ref([])
  const folder = ref('')
  const shown = ref(null)
  const error = ref('')
  const loading = ref(true)

  const readable = computed(() => files.value.length)

  const read = async path => {
    const token = (await current_user.value?.getIdToken()) ?? null
    const response = await fetch(path, {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    return response.ok ? response.json() : null
  }

  const list = async (path = '') => {
    const payload = await read(
      `/v1/vault/artifacts?folder=${encodeURIComponent(path)}`
    )
    if (!payload) {
      error.value = 'Your artifacts could not load.'
      return
    }
    folder.value = path
    files.value = payload.files
    shown.value = null
  }

  const open = async file => {
    if (file.kind === 'folder') return list(file.path)
    const payload = await read(
      `/v1/vault/artifacts?path=${encodeURIComponent(file.path)}`
    )
    if (!payload) {
      error.value = 'That file cannot show here.'
      return
    }
    error.value = ''
    shown.value = payload
  }

  const up = () => {
    const parts = folder.value.split('/').filter(Boolean)
    parts.pop()
    return list(parts.join('/'))
  }

  on_mounted(async () => {
    await list('')
    loading.value = false
  })
</script>
