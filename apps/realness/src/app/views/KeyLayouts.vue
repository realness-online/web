<template>
  <article
    itemscope
    itemtype="https://schema.org/WebPage"
    aria-label="Key layouts">
    <header aria-label="Key layouts">
      <nav aria-label="Related">
        <router-link to="/vault">Vault</router-link>
        <router-link to="/vault/tools">Tools</router-link>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <template v-else-if="page">
      <header aria-label="About the keys">
        <h2>{{ page.title }}</h2>
        <p>{{ page.description }}</p>
        <ul aria-label="Legend">
          <li
            v-for="entry in page.legend"
            :key="entry.label"
            :data-group="entry.group"
            :data-reserved="entry.reserved">
            {{ entry.label }}
          </li>
        </ul>
        <p v-for="note in page.notes" :key="note">{{ note }}</p>
      </header>
      <section
        v-for="section in page.sections"
        :key="section.id"
        :id="section.id">
        <h2>{{ section.title }}</h2>
        <figure v-for="figure in section.figures" :key="figure.map">
          <KeyBoard
            :map="keys.layouts[figure.map] ?? {}"
            :rows="keys.rows"
            :panel="figure.panel"
            :panel_on="keys.panel_on"
            :pi_reserved="keys.pi_reserved"
            :pi_windows="keys.pi_windows"
            :reserved="mark_reserved(figure)"
            :label="figure.map" />
          <figcaption>{{ figure.caption }}</figcaption>
        </figure>
        <dl>
          <template v-for="term in section.terms" :key="term.term">
            <dt>{{ term.term }}</dt>
            <dd>{{ term.detail }}</dd>
          </template>
        </dl>
      </section>
    </template>
  </article>
</template>

<script setup>
  import { onMounted as on_mounted, ref } from 'vue'
  import KeyBoard from '@/components/key/as-board.vue'
  import { current_user } from '@/utils/serverless'

  /** Leader and terminal maps are not Option keys, so Pi cannot collide with them. */
  const mark_reserved = figure =>
    !['leader', 'terminal_ctrl'].includes(figure.map) && !figure.panel

  const page = ref(null)
  const keys = ref({
    rows: [],
    layouts: {},
    panel_on: [],
    pi_reserved: [],
    pi_windows: []
  })
  const error = ref('')
  const loading = ref(true)

  on_mounted(async () => {
    const token = (await current_user.value?.getIdToken()) ?? null
    const response = await fetch('/v1/vault/keys', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    loading.value = false
    if (!response.ok) {
      error.value = 'Your key layouts could not load.'
      return
    }
    const payload = await response.json()
    if (!payload?.keys?.page) {
      error.value = 'Your key layouts could not load.'
      return
    }
    page.value = payload.keys.page
    keys.value = payload.keys
  })
</script>
