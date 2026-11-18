<script setup>
  import AsPosterChoice from '@/components/blog/as-poster-choice.vue'
  import { onMounted as mounted, ref } from 'vue'
  import { load } from '@/utils/itemid'
  import { use_posters } from '@/use/poster'
  import { poster_choices } from '@/blog/poster-choices'

  defineEmits(['pick', 'close'])

  const choices = ref([])
  const found = ref(0)
  const loading = ref(true)

  const me = () => window.localStorage?.me ?? null

  mounted(async () => {
    const id = me()
    if (!id) {
      loading.value = false
      return
    }
    const { for_person, posters } = use_posters()
    await for_person({ id })
    found.value = posters.value.length
    choices.value = await poster_choices(posters.value, load)
    loading.value = false
  })
</script>

<template>
  <aside aria-label="Your posters">
    <header>
      <h2>Your posters</h2>
      <button type="button" @click="$emit('close')">Close</button>
    </header>
    <p v-if="loading" role="status">Loading posters</p>
    <p v-else-if="!found" role="status">No posters yet</p>
    <p v-else-if="!choices.length" role="status">Posters could not load</p>
    <ul v-else>
      <li v-for="choice in choices" :key="choice.id">
        <button type="button" @click="$emit('pick', choice.id)">
          <as-poster-choice :svg="choice.svg" />
        </button>
      </li>
    </ul>
  </aside>
</template>

<style lang="stylus">
  aside[aria-label='Your posters'] {
    position: fixed;
    inset-block: 0;
    inset-inline-end: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: var(--base-line);
    inline-size: min(22rem, 100dvw);
    padding: var(--base-line);
    overflow-y: auto;
    background: var(--surface);
    color: var(--text);
    border-inline-start: 1px solid var(--muted-text);

    > header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--base-line);

      h2 {
        margin: 0;
        font-size: 1rem;
      }
    }

    ul {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
      gap: calc(var(--base-line) * 0.5);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    button {
      inline-size: 100%;
      padding: 0;
      border: 1px solid transparent;
      background: none;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        border-color: var(--accent);
      }
    }
  }
</style>
