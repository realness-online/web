<script setup>
  import sync from '@/components/sync'
  import PreferencesDialog from '@/components/profile/as-dialog-preferences.vue'
  import fps from '@/components/fps'
  import {
    ref,
    onUnmounted as dismount,
    onMounted as mounted,
    provide
  } from 'vue'
  import { init_serverless } from '@/utils/serverless'
  import { useRouter as use_router } from 'vue-router'
  import { fps as fps_pref } from '@/utils/preference'
  /** @type {import('vue').Ref<'working' | 'offline' | null>} */
  const status = ref(null)
  const router = use_router()

  const show_utility_components = ref(true)
  provide('show_utility_components', show_utility_components)

  /** @param {boolean} active */
  const sync_active = active => {
    if (active) status.value = 'working'
    else status.value = null
  }
  const online = () => {
    const editable = document.querySelectorAll('[contenteditable]')
    editable.forEach(e => e.setAttribute('contenteditable', 'true'))
    status.value = null
  }
  const offline = () => {
    const editable = document.querySelectorAll('[contenteditable]')
    editable.forEach(e => e.setAttribute('contenteditable', 'false'))
    status.value = 'offline'
  }
  mounted(async () => {
    const is_standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone || // for iOS
      document.referrer.includes('android-app://')

    if (is_standalone) sessionStorage.about = true

    if (!sessionStorage.about) router.push('/about')

    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    await init_serverless()
  })
  dismount(() => {
    window.removeEventListener('online', online)
    window.removeEventListener('offline', offline)
  })
</script>

<template>
  <main id="realness" :class="status">
    <router-view />
    <sync @active="sync_active" />
    <fps v-if="fps_pref && show_utility_components" />
    <preferences-dialog v-if="show_utility_components" />
  </main>
</template>

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
