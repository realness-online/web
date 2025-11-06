<script setup>
  import sync from '@/components/sync'
  import DialogPreferences from '@/components/profile/as-dialog-preferences.vue'
  import DialogDocumentation from '@/components/as-dialog-documentation.vue'
  import DialogAccount from '@/components/profile/as-dialog-account.vue'
  import FpsComponent from '@/components/fps'
  import Viewbox from '@/components/viewbox'
  import {
    ref,
    onUnmounted as dismount,
    onMounted as mounted,
    provide
  } from 'vue'
  import { useFps } from '@vueuse/core'
  import { init_serverless } from '@/utils/serverless'
  import { useRouter as use_router } from 'vue-router'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use_keymap } from '@/use/key-commands'
  import {
    fill,
    stroke,
    cutout,
    drama,
    bold,
    medium,
    regular,
    light,
    background,
    boulder,
    rock,
    gravel,
    sand,
    sediment,
    animate,
    info,
    storytelling,
    slice,
    grid_overlay
  } from '@/utils/preference'

  /** @type {import('vue').Ref<'working' | 'offline' | null>} */
  const status = ref(null)
  const router = use_router()

  // FPS tracking for adaptive animations
  const fps = useFps()
  provide('fps', fps)

  const {
    vVectorizer,
    image_picker,
    new_vector,
    current_processing,
    open_camera,
    select_photo,
    can_add,
    init_processing_queue,
    queue_items
  } = use_vectorize()
  provide('image-picker', image_picker)
  provide('new_vector', new_vector)
  provide('current_processing', current_processing)
  provide('open_camera', open_camera)
  provide('select_photo', select_photo)
  provide('can_add', can_add)
  provide('init_processing_queue', init_processing_queue)
  provide('queue_items', queue_items)

  const documentation = ref(null)
  provide('documentation', documentation)

  const preferences_dialog = ref(null)
  const account_dialog = ref(null)
  const { register, register_preference } = use_keymap('Global')

  register('pref::Toggle_Fill', () => {
    const new_state = !fill.value
    fill.value = new_state
    if (new_state) {
      bold.value = true
      medium.value = true
      regular.value = true
      light.value = true
      background.value = true
    }
  })

  register_preference('pref::Toggle_Stroke', stroke)
  register('pref::Toggle_Cutout', () => {
    const new_state = !cutout.value
    cutout.value = new_state
    if (new_state) {
      boulder.value = true
      rock.value = true
      gravel.value = true
      sand.value = true
      sediment.value = true
    }
  })
  register_preference('pref::Toggle_Background', background)
  register_preference('pref::Toggle_Drama', drama)
  register_preference('pref::Toggle_Animate', animate)
  register_preference('pref::Toggle_Info', info)
  register_preference('pref::Toggle_Storytelling', storytelling)
  register_preference('pref::Toggle_Slice', slice)
  register_preference('pref::Toggle_Grid', grid_overlay)

  register_preference('pref::Toggle_Bold', bold)
  register_preference('pref::Toggle_Medium', medium)
  register_preference('pref::Toggle_Regular', regular)
  register_preference('pref::Toggle_Light', light)

  register_preference('pref::Toggle_Boulder', boulder)
  register_preference('pref::Toggle_Rock', rock)
  register_preference('pref::Toggle_Gravel', gravel)
  register_preference('pref::Toggle_Sand', sand)
  register_preference('pref::Toggle_Sediment', sediment)

  register('ui::Show_Documentation', () => {
    console.log('ui::Show_Documentation')
    documentation.value?.show()
  })
  register('ui::Open_Settings', () => {
    console.log('ui::Open_Settings')
    preferences_dialog.value?.show()
  })
  register('ui::Open_Account', () => {
    console.log('ui::Open_Account')
    account_dialog.value?.show()
  })
  register('ui::Toggle_Presentation', () =>
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
    <fps-component v-if="info" />
    <viewbox v-if="info" />
    <dialog-preferences ref="preferences_dialog" />
    <dialog-documentation ref="documentation" />
    <dialog-account ref="account_dialog" />
    <input
      ref="image_picker"
      class="poster picker"
      v-vectorizer
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/tiff,image/avif,image/svg+xml" />
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
