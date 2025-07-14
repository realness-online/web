<script setup>
  import sync from '@/components/sync'
  import DialogPreferences from '@/components/profile/as-dialog-preferences.vue'
  import DialogDocumentation from '@/components/as-dialog-documentation.vue'
  import fps_component from '@/components/fps'
  import Viewbox from '@/components/viewbox'
  import {
    ref,
    onUnmounted as dismount,
    onMounted as mounted,
    provide
  } from 'vue'
  import { init_serverless } from '@/utils/serverless'
  import { useRouter as use_router} from 'vue-router'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use_keymap } from '@/use/key-commands'
  import {
    fill,
    stroke,
    cutout,
    background,
    light,
    animate,
    fps,
    storytelling,
    bold_layer,
    medium_layer,
    regular_layer,
    light_layer
  } from '@/utils/preference'

  /** @type {import('vue').Ref<'working' | 'offline' | null>} */
  const status = ref(null)
  const router = use_router()

  const { vVectorizer, image_picker, mount_workers } = use_vectorize()
  provide('image-picker', image_picker)

  const documentation = ref(null)
  provide('documentation', documentation)

  const preferences_dialog = ref(null)
  const { register, register_preference } = use_keymap('Global')

  // Special handler for fill (F key) - master control for all layers
  register('pref::Toggle_Fill', () => {
    if (fill.value) {
      // Turning fill off - turn off all layers
      bold_layer.value = false
      medium_layer.value = false
      regular_layer.value = false
      light_layer.value = false
      fill.value = false
    } else {
      // Turning fill on - turn on all layers (default state)
      bold_layer.value = true
      medium_layer.value = true
      regular_layer.value = true
      light_layer.value = true
      fill.value = true
    }
  })

  // Regular preference toggles for individual layers
  register_preference('pref::Toggle_Stroke', stroke)
  register_preference('pref::Toggle_Cutout', cutout)
  register_preference('pref::Toggle_Background', background)
  register_preference('pref::Toggle_Light', light)
  register_preference('pref::Toggle_Animate', animate)
  register_preference('pref::Toggle_FPS', fps)
  register_preference('pref::Toggle_Storytelling', storytelling)
  register_preference('pref::Toggle_Bold_Layer', bold_layer)
  register_preference('pref::Toggle_Medium_Layer', medium_layer)
  register_preference('pref::Toggle_Regular_Layer', regular_layer)
  register_preference('pref::Toggle_Light_Layer', light_layer)

  register('ui::Show_Documentation', () => documentation.value?.show())
  register('ui::Open_Settings', () => preferences_dialog.value?.show())
  register('ui::Toggle_Fullscreen', () =>
    !document.fullscreenElement
      ? document.documentElement.requestFullscreen()
      : document.exitFullscreen()
  )

  register('nav::Go_Home', () => router.push('/'))
  register('nav::Go_Statements', () => router.push('/statements'))
  register('nav::Go_Events', () => router.push('/events'))
  register('nav::Go_Posters', () => router.push('/posters'))
  register('nav::Go_Phonebook', () => router.push('/phonebook'))
  register('nav::Go_Thoughts', () => router.push('/thoughts'))
  register('nav::Go_About', () => router.push('/about'))

  /** @param {boolean} active */
  const sync_active = active => {
    if (active) status.value = 'working'
    else status.value = null
  }
  const online = () => {
    document
      .querySelectorAll('[contenteditable]')
      ?.forEach(e => e.setAttribute('contenteditable', 'true'))
    status.value = null
  }
  const offline = () => {
    document
      .querySelectorAll('[contenteditable]')
      ?.forEach(e => e.setAttribute('contenteditable', 'false'))
    status.value = 'offline'
  }
  mounted(async () => {
    const is_standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator['standalone'] || // for iOS
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
    <fps_component v-if="fps" />
    <viewbox v-if="fps" />
    <dialog-preferences ref="preferences_dialog" />
    <dialog-documentation ref="documentation" />
    <input
      ref="image_picker"
      class="poster picker"
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
