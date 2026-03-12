<script setup>
  import sync from '@/components/sync'
  import { defineAsyncComponent as define_async_component } from 'vue'
  const AsDialogPreferences = define_async_component(
    () => import('@/components/profile/as-dialog-preferences.vue')
  )
  const AsDialogDocumentation = define_async_component(
    () => import('@/components/as-dialog-documentation.vue')
  )
  const AsFps = define_async_component(() => import('@/components/as-fps.vue'))
  import WorkingBorder from '@/components/working-border.vue'
  import Icon from '@/components/icon'
  import {
    ref,
    computed,
    watch,
    onUnmounted as dismount,
    onMounted as mounted,
    provide
  } from 'vue'
  import {
    useFps,
    useMagicKeys,
    useFullscreen,
    useActiveElement
  } from '@vueuse/core'
  import { useRouter as use_router } from 'vue-router'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use_keymap } from '@/use/key-commands'
  import { posting } from '@/use/posting'
  import {
    ANIMATION_SPEEDS,
    ANIMATION_SPEED_LEGACY,
    DEFAULT_ANIMATION_SPEED
  } from '@/utils/animation-config'
  import {
    shadow,
    stroke,
    mosaic,
    drama,
    drama_back,
    drama_front,
    bold,
    medium,
    regular,
    light,
    background,
    boulders,
    rocks,
    gravel,
    sand,
    sediment,
    animate,
    animation_speed,
    info,
    storytelling,
    grid_overlay,
    aspect_ratio_mode,
    slice_alignment,
    menu,
    footer_visible
  } from '@/utils/preference'

  /** @type {import('vue').Ref<'working' | 'offline' | null>} */
  const status = ref(null)
  const router = use_router()

  const fps = useFps()
  provide('fps', fps)

  const working_count = ref(0)
  /** @param {boolean} active */
  const set_working = active => {
    if (active) working_count.value++
    else if (working_count.value > 0) working_count.value--
    status.value = working_count.value > 0 ? 'working' : null
  }
  provide('set_working', set_working)

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

  const { isFullscreen } = useFullscreen()
  const active_el = useActiveElement()
  const thought_has_focus = computed(
    () => !!active_el.value?.closest?.('article.thought')
  )

  const preferences_dialog = ref(null)
  const account_open = ref(null)
  const register_account = fn => {
    account_open.value = fn
  }
  provide('register_account', register_account)
  provide('open_account', () => account_open.value?.())
  const viewport_mql = ref(null)
  const { register, register_preference } = use_keymap('Global')
  const magic_keys = useMagicKeys()

  register('pref::Toggle_Shadow', () => {
    const new_state = !shadow.value
    shadow.value = new_state
    if (new_state) {
      bold.value = true
      medium.value = true
      regular.value = true
      light.value = true
      background.value = true
    }
  })

  register_preference('pref::Toggle_Stroke', stroke)
  register('pref::Toggle_Mosaic', () => {
    const new_state = !mosaic.value
    mosaic.value = new_state
    if (new_state) {
      boulders.value = true
      rocks.value = true
      gravel.value = true
      sand.value = true
      sediment.value = true
    }
  })
  register_preference('pref::Toggle_Background', background)
  register('pref::Toggle_Drama', () => {
    const new_state = !drama.value
    drama.value = new_state
    drama_back.value = new_state
    drama_front.value = new_state
  })
  register('pref::Cycle_Drama', () => {
    if (!drama_back.value && !drama_front.value) {
      drama_back.value = true
      drama_front.value = false
    } else if (drama_back.value && !drama_front.value) {
      drama_back.value = false
      drama_front.value = true
    } else if (!drama_back.value && drama_front.value) {
      drama_back.value = true
      drama_front.value = true
    } else {
      drama_back.value = false
      drama_front.value = false
    }
    drama.value = drama_back.value || drama_front.value
  })
  register_preference('pref::Toggle_Animate', animate)
  register('pref::Cycle_Animation_Speed', () => {
    const current =
      ANIMATION_SPEED_LEGACY[animation_speed.value] ||
      animation_speed.value ||
      DEFAULT_ANIMATION_SPEED
    const current_index = ANIMATION_SPEEDS.indexOf(current)
    const next_index = (current_index + 1) % ANIMATION_SPEEDS.length
    animation_speed.value = ANIMATION_SPEEDS[next_index]
  })
  register_preference('pref::Toggle_Info', info)
  register_preference('pref::Toggle_Storytelling', storytelling)
  register('pref::Cycle_Aspect_Ratio', () => {
    const aspect_ratios = ['auto', '1/1', '1.618/1', '16/9', '2.35/1', '2.76/1']
    const current = aspect_ratio_mode.value || 'auto'
    const current_index = aspect_ratios.indexOf(current)
    const is_reverse = magic_keys.shift.value
    const next_index = is_reverse
      ? (current_index - 1 + aspect_ratios.length) % aspect_ratios.length
      : (current_index + 1) % aspect_ratios.length
    aspect_ratio_mode.value = aspect_ratios[next_index]
    document.documentElement.style.setProperty(
      '--poster-aspect-ratio',
      aspect_ratio_mode.value === 'auto' ? 'auto' : aspect_ratio_mode.value
    )
  })
  register('pref::Slice_Alignment_Up', () => {
    const current = slice_alignment.value || 'ymid'
    if (current === 'ymid') slice_alignment.value = 'ymin'
    else if (current === 'ymax') slice_alignment.value = 'ymid'
  })
  register('pref::Slice_Alignment_Down', () => {
    const current = slice_alignment.value || 'ymid'
    if (current === 'ymid') slice_alignment.value = 'ymax'
    else if (current === 'ymin') slice_alignment.value = 'ymid'
  })
  register_preference('pref::Toggle_Grid', grid_overlay)
  register_preference('pref::Toggle_Menu', menu)
  register_preference('pref::Toggle_Footer', footer_visible)

  const set_storytelling_slide_width = () => {
    const is_landscape = window.matchMedia('(min-aspect-ratio: 1/1)').matches
    const width =
      is_landscape && aspect_ratio_mode.value === '1/1' ? '100vh' : '100vw'
    document.documentElement.style.setProperty(
      '--storytelling-slide-width',
      width
    )
  }

  watch(aspect_ratio_mode, new_value => {
    document.documentElement.style.setProperty(
      '--poster-aspect-ratio',
      new_value === 'auto' ? 'auto' : new_value
    )
    set_storytelling_slide_width()
  })

  register_preference('pref::Toggle_Bold', bold)
  register_preference('pref::Toggle_Medium', medium)
  register_preference('pref::Toggle_Regular', regular)
  register_preference('pref::Toggle_Light', light)

  register_preference('pref::Toggle_Boulders', boulders)
  register_preference('pref::Toggle_Rocks', rocks)
  register_preference('pref::Toggle_Gravel', gravel)
  register_preference('pref::Toggle_Sand', sand)
  register_preference('pref::Toggle_Sediment', sediment)

  register('ui::Show_Documentation', () => {
    documentation.value?.show()
  })
  register('ui::Open_Settings', () => {
    preferences_dialog.value?.show()
  })
  register('ui::Open_Account', () => account_open.value?.())
  register('ui::Clear_Sync_Time', () => {
    delete localStorage.sync_time
  })
  register('ui::Toggle_Presentation', () =>
    !document.fullscreenElement
      ? document.documentElement.requestFullscreen()
      : document.exitFullscreen()
  )

  register('nav::Go_Home', () => router.push('/'))
  register('nav::Go_Statements', () => router.push('/'))
  register('nav::Go_Events', () => router.push('/events'))
  register('nav::Go_Posters', () => router.push('/posters'))
  register('nav::Go_Phonebook', () => router.push('/phonebook'))
  register('nav::Go_Thoughts', () => router.push('/'))
  register('nav::Go_About', () => router.push('/about'))

  /** @param {boolean} active */
  const sync_active = active => set_working(active)
  const online = () => {
    document
      .querySelectorAll('[contenteditable]')
      ?.forEach(e => e.setAttribute('contenteditable', 'true'))
    status.value = working_count.value > 0 ? 'working' : null
  }
  const offline = () => {
    document
      .querySelectorAll('[contenteditable]')
      ?.forEach(e => e.setAttribute('contenteditable', 'false'))
    status.value = 'offline'
  }
  mounted(() => {
    if (window.matchMedia('(display-mode: standalone)').matches)
      sessionStorage.about = true
    const has_drama_back = localStorage.getItem('drama_back') !== null
    const has_drama_front = localStorage.getItem('drama_front') !== null
    if (!has_drama_back && !has_drama_front && drama.value) {
      drama_back.value = true
      drama_front.value = true
    }

    const aspect_ratio = aspect_ratio_mode.value || 'auto'
    document.documentElement.style.setProperty(
      '--poster-aspect-ratio',
      aspect_ratio === 'auto' ? 'auto' : aspect_ratio
    )
    set_storytelling_slide_width()
    viewport_mql.value = window.matchMedia('(min-aspect-ratio: 1/1)')
    viewport_mql.value.addEventListener('change', set_storytelling_slide_width)

    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
  })
  dismount(() => {
    viewport_mql.value?.removeEventListener(
      'change',
      set_storytelling_slide_width
    )
    window.removeEventListener('online', online)
    window.removeEventListener('offline', offline)
  })
</script>

<template>
  <main id="realness" :class="[status, { posting }]">
    <teleport to="body">
      <working-border v-if="status === 'working'" />
    </teleport>
    <router-view />
    <sync @active="sync_active" />
    <as-fps v-if="info" />
    <div id="global-menu">
      <footer id="global-footer">
        <a
          v-if="can_add"
          id="add-poster"
          tabindex="0"
          aria-label="Add poster"
          @click="select_photo"
          @keydown.enter="select_photo">
          <icon name="add" />
        </a>
        <a
          id="camera"
          tabindex="0"
          @click="open_camera"
          @keydown.enter="open_camera">
          <icon name="camera" />
        </a>
        <as-dialog-preferences ref="preferences_dialog" />
      </footer>
      <button
        v-if="!isFullscreen && !thought_has_focus"
        type="button"
        :aria-expanded="footer_visible"
        :aria-label="footer_visible ? 'Hide footer' : 'Show footer'"
        @click="footer_visible = !footer_visible" />
    </div>

    <as-dialog-documentation ref="documentation" />
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
      border-width: (base-line * 0.1);
      border-color: var(--blue);
      border-radius: (base-line * 3);
      position: relative;
    }
    & > h6 {
      text-shadow: 1px 1px 1.25px var(--black-background);
      position: fixed;
      display: none;
      top: 0;
      left: var(--base-line);
    }
  }
  div#global-menu {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: min(100%, page-width);
    max-width: page-width;
    margin: base-line auto;
    z-index: 9;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: base-line * 0.25;
    padding-bottom: env(safe-area-inset-bottom, 0);
    overflow: visible;
  }
  footer#global-footer {
    width: 100%;
    background-color: hsla(228, 9.8%, 6%, 0.75);
    border-radius: base-line;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: base-line;
    padding: base-line * 0.5;
    padding-bottom: s('calc(var(--base-line) * 0.5 + env(safe-area-inset-bottom, 0))');
    pointer-events: none;
    transition: transform 0.25s ease, opacity 0.25s ease, visibility 0.25s;
    transition-behavior: allow-discrete;
    @starting-style {
      transform: translateY(100%);
      opacity: 0;
      visibility: hidden;
    }
    & > * {
      pointer-events: auto;
    }
    & a#toggle-preferences,
    & a#add-poster,
    & a#camera,
    & label[for='wat'],
    & a[aria-label='Go to thoughts'] {
      position: static;
      color: var(--blue);
      cursor: pointer;
      svg {
        fill: var(--blue);
        stroke: var(--blue);
      }
      &:focus {
        outline: 2px solid var(--red);
      }
    }
    & a#toggle-preferences svg {
      width: base-line * 1.35;
      height: base-line * 1.35;
    }
    & a#add-poster svg {
      width: base-line * 1.35;
      height: base-line * 1.35;
    }
    & a#camera svg {
      width: base-line * 2;
      height: base-line * 2;
    }
  }
  div#global-menu:has(button[aria-expanded='false']) #global-footer {
    transform: translateY(100%);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  div#global-menu > button[aria-expanded='false'] {
    outline: 2px solid var(--red);
    outline-offset: base-line * 0.25;
  }
  div#global-menu > button {
    z-index: 10;
    width: base-line * 4;
    height: base-line * 0.5;
    padding: 0;
    border: none;
    border-radius: base-line;
    cursor: pointer;
    transition: background-color 0.2s ease;
    pointer-events: auto;
    background-color: var(--black-transparent);
    box-shadow: 0 0 base-line var(--black-transparent);
    &:hover {
      background-color: var(--black-background);
    }
    &:focus {
      outline: 2px solid var(--red);
      outline-offset: base-line * 0.25;
    }
    &[aria-expanded='true']:focus {
      outline: none;
    }
  }
</style>
