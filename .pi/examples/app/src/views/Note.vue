<script setup>
  import { ref, useTemplateRef } from 'vue'
  import { useRouter } from 'vue-router'
  import { Note, load, note_id, remove } from '../store.js'

  const props = defineProps({ created: { type: String, required: true } })
  const router = useRouter()
  const id = note_id(props.created)
  const saved = load(id)
  const name = ref(saved?.name ?? '')
  const text = ref(saved?.text ?? '')
  const item = useTemplateRef('item')

  // The store saves the rendered article itself: the HTML is the record.
  const save = () => {
    new Note(id).save(item.value)
    router.push('/')
  }
  const destroy = () => {
    remove(id)
    router.push('/')
  }
</script>

<template>
  <form @submit.prevent="save">
    <input v-model="name" placeholder="Title" aria-label="Title" />
    <textarea v-model="text" placeholder="Write" aria-label="Note" />
    <menu>
      <button type="submit">Save</button>
      <button v-if="saved" type="button" @click="destroy">Delete</button>
    </menu>
  </form>
  <article ref="item" itemscope itemtype="/note" :itemid="id">
    <h2 itemprop="name">{{ name }}</h2>
    <p itemprop="text">{{ text }}</p>
  </article>
</template>
