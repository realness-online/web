<script setup>
  import sync from '@/components/sync'
  import PreferencesDialog from '@/components/profile/as-dialog-preferences.vue'
  import KeyCommandsModal from '@/components/key-commands-modal.vue'
  import DocumentationModal from '@/components/documentation-modal.vue'
  import fps from '@/components/fps'
  import Viewbox from '@/components/viewbox'
  import {
    ref,
    onUnmounted as dismount,
    onMounted as mounted,
    provide,
    computed
  } from 'vue'
  import { init_serverless } from '@/utils/serverless'
  import { useRouter as use_router, useRoute as use_route } from 'vue-router'
  import { fps as fps_pref } from '@/utils/preference'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use_keymap } from '@/use/key-commands'

  /** @type {import('vue').Ref<'working' | 'offline' | null>} */
  const status = ref(null)
  const router = use_router()
  const route = use_route()


  const { vVectorizer, image_picker, mount_workers } = use_vectorize()
  provide('image-picker', image_picker)

  const key_commands_modal = ref(null)
  provide('key-commands-modal', key_commands_modal)

  const documentation_modal = ref(null)
  provide('documentation-modal', documentation_modal)

  const { register } = use_keymap('Global')

  register('ui::Show_Key_Commands', () => {
    if (key_commands_modal.value) key_commands_modal.value.show()
  })

  register('ui::Show_Documentation', () => {
    if (documentation_modal.value) documentation_modal.value.show()
  })

  register('ui::Close_Modal', () => {
    const open_dialogs = document.querySelectorAll('dialog[open]')
    open_dialogs.forEach(dialog => dialog.close())
  })

  register('ui::Open_Settings', () => {
    const settings_dialog = document.querySelector('dialog#preferences')
    if (settings_dialog) settings_dialog.showModal()
  })

  register('ui::Toggle_Fullscreen', () => {
    if (!document.fullscreenElement)  document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  })

  register('nav::Go_Home', () => router.push('/') )
  register('nav::Go_Statements', () => router.push('/statements')  )
  register('nav::Go_Events', () => router.push('/events'))
  register('nav::Go_Posters', () => router.push('/posters'))
  register('nav::Go_Phonebook', () =>  router.push('/phonebook'))
  register('nav::Go_Thoughts', () => router.push('/thoughts'))

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
    mount_workers()
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
    <fps v-if="fps_pref" />
    <viewbox v-if="fps_pref" />
    <preferences-dialog />
    <key-commands-modal ref="key_commands_modal" />
    <documentation-modal ref="documentation_modal" />
    <input
      ref="image_picker"
      v-vectorizer
      type="file"
      accept="image/jpeg,image/png" />
  </main>
</template>

<style src="@/style/index.styl" lang="stylus"></style>

<style lang="stylus">
  main#realness {
    border: (base-line / 16) solid transparent;
    border-radius (base-line / 16);
    &.offline {
      border-color: var(--yellow);
    }
    &.working {
      border-color: var(--green);
      animation-name: pulsing;
      animation-duration: 5s;
      animation-delay: 200ms;
      animation-iteration-count: infinite;
    }
    & > h6 {
      text-shadow: 1px 1px 1.25px var(--black-background);
      position: fixed;
      display: none;
      top: 0;
      left: var(--base-line);
    }
  }
</style>
