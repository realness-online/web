<template>
  <main id="realness" :class="status">
    <router-view />
    <sync @active="sync_active" />
  </main>
</template>
<script setup>
  import sync from '@/components/sync'
  import {
    ref,
    onUnmounted as dismount,
    onMounted as mounted,
    watch
  } from 'vue'
  import { useFps as use_fps } from '@vueuse/core'
  const frames_per_second = use_fps()
  const status = ref(null)
  const me = ref(undefined)
  const statement = ref(undefined)
  const sync_active = active => {
    if (active) status.value = 'working'
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
  watch(frames_per_second, () => {
    if (frames_per_second.value < 60) console.log(frames_per_second.value)
  })
  mounted(() => {
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
  })
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
    & > h6
      text-shadow: 1px 1px 1.25px black-background
      position: fixed
      display: none
      top: 0
      left: base-line
</style>
