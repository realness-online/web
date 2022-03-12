<template>
  <main id="realness" :class="status">
    <router-view
      v-if="!working"
      v-model:statement="statement"
      v-model:person="me" />
    <aside v-if="!working">
      <sync v-model:statement="statement" :person="me" @active="sync_active" />
    </aside>
  </main>
</template>
<script setup>
  import { onUnmounted as dismount } from 'vue'
  import firebase from 'firebase/compat/app'
  import { get, set } from 'idb-keyval'
  import sync from '@/components/sync'
  const working = ref(true)
  const status = ref(null)
  const me = ref(undefined)
  const statement = ref(undefined)
  const sync_active = active => {
    if (active.value) status.value = 'working'
    else status.value = null
  }
  const online = () => {
    const editable = document.querySelectorAll('[contenteditable]')
    editable.forEach(e => e.setAttribute('contenteditable', true))
    status.value = null
  }
  const offline = () => {
    const editable = document.querySelectorAll('[contenteditable]')
    editable.forEach(e => e.setAttribute('contenteditable', false))
    status.value = 'offline'
  }
  window.addEventListener('online', online)
  window.addEventListener('offline', offline)
  working.value = false
  dismount(() => {
    window.removeEventListener('online', online)
    window.removeEventListener('offline', offline)
  })
</script>
<style src="@/style/index.styl" lang="stylus"></style>
<style lang="stylus">
  main
    border: (base-line / 16) solid transparent
    border-radius (base-line / 16)
    &.offline
      border-color: yellow
    &.working
      border-color: green
      animation-name: pulsing
      animation-duration: 5s
      animation-delay: 200ms
      animation-iteration-count: infinite
</style>
