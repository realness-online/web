<script setup>
  import { useRouter } from 'vue-router'
  import { itemid, list } from '../store.js'

  const router = useRouter()
  const notes = list()
  const created = id => itemid.as_created_at(id)
  const write = () => router.push(`/notes/${Date.now()}`)
</script>

<template>
  <menu><button @click="write">New note</button></menu>
  <ol v-if="notes.length">
    <li v-for="note in notes" :key="note.id">
      <router-link :to="`/notes/${created(note.id)}`">
        <article itemscope itemtype="/note" :itemid="note.id">
          <h2 itemprop="name">{{ note.name || 'Untitled' }}</h2>
          <p itemprop="text">{{ note.text.slice(0, 120) }}</p>
        </article>
      </router-link>
    </li>
  </ol>
  <p v-else>No notes yet.</p>
</template>
