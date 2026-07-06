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
  import SupportLayout from '@/components/support-layout'
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
    grid,
    aspect_ratio_mode,
    slice_alignment,
    menu,
    footer_visible,
    view_3d
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

  // Lazy vectorize: load after first paint so heavy deps (potrace,
  // persistence) don't block the critical path. The module is loaded via
  // dynamic import after mount, and its refs are synced to the local stubs
  // so injected values remain reactive.
  const image_picker = ref(null)
  const new_vector = ref(null)
  const current_processing = ref(null)
  const queue_items = ref([])
  let select_photo = () => {}
  let open_camera = () => {}
  let queue_supported_files = () => false
  let queue_supported_clipboard_items = () => false
  let init_processing_queue = async () => {}

  // Stub directive — the real change listener is attached when the vectorize
  // module loads. Named vVectorizer so <script setup> registers it as
  // v-vectorizer and the template compiles without a resolve warning.
  const vVectorizer = {}
  // Cleanup for the deferred vectorize module; replaced once it loads.
  let dismount_vectorize = () => {}

  mounted(() => {
    // Defer vectorize module load to after first paint
    requestAnimationFrame(async () => {
      const { use } = await import('@/use/vectorize')
      // Pass the picker ref directly: use() runs outside setup() here, so it
      // cannot inject('image-picker'). The ref is already bound to the input.
      const api = use(image_picker)
      dismount_vectorize = api.unmount
      // Attach the real file picker change listener
      if (api.vVectorizer?.mounted && image_picker.value)
        api.vVectorizer.mounted(image_picker.value)
      // Sync reactive values from the API to our local refs
      watch(
        () => api.new_vector.value,
        val => {
          new_vector.value = val
        },
        { immediate: true }
      )
      watch(
        () => api.current_processing.value,
        val => {
          current_processing.value = val
        },
        { immediate: true }
      )
      watch(
        () => api.queue_items.value,
        val => {
          queue_items.value = val
        },
        { immediate: true }
      )
      // Delegate functions to the loaded API
      select_photo = () => api.select_photo()
      open_camera = () => api.open_camera()
      queue_supported_files = files => api.queue_supported_files(files)
      queue_supported_clipboard_items = items =>
        api.queue_supported_clipboard_items(items)
      init_processing_queue = () => api.init_processing_queue()
      // Load any pending queue items that survived page reload.
      // Skip feed_needs_refresh — the feed already loaded and queue items
      // render in a separate processing section, not in the feed.
      await init_processing_queue()
    })
  })

  provide('image-picker', image_picker)
  provide('new_vector', new_vector)
  provide('current_processing', current_processing)
  provide('open_camera', () => {
    open_camera()
  })
  provide('select_photo', () => {
    select_photo()
  })
  provide('init_processing_queue', async () => {
    await init_processing_queue()
  })
  provide('queue_items', queue_items)

  const documentation = ref(null)
  provide('documentation', documentation)

  const { isFullscreen } = useFullscreen()
  const active_el = useActiveElement()
  /** Only on home (Thoughts): hide footer switch while focus is inside a thought (e.g. editor). Profile and other routes still render thoughts in the feed; do not steal the switch there. */
  const thought_hides_footer_switch = computed(() => {
    if (router.currentRoute.value.path !== '/') return false
    return !!active_el.value?.closest?.('article.thought')
  })

  const footer_toggle_shown = computed(
    () => !isFullscreen.value && !thought_hides_footer_switch.value
  )

  /** @param {Event} event */
  const on_footer_visible_change = event => {
    const el = /** @type {HTMLInputElement | null} */ (event.target)
    if (!el) return
    footer_visible.value = el.checked
  }

  const add_icon_hovered = ref(false)
  const add_settling = ref(false)

  const on_add_icon_enter = () => {
    add_icon_hovered.value = true
    add_settling.value = false
  }

  const play_add_icon_settle = () => {
    if (!add_icon_hovered.value) return
    add_icon_hovered.value = false
    add_settling.value = false
    requestAnimationFrame(() => {
      add_settling.value = true
    })
  }

  /** @param {AnimationEvent} event */
  const on_add_icon_animation_end = event => {
    if (event.animationName !== 'add-plus-flourish-out') return
    add_settling.value = false
  }

  const animation_icon_hovered = ref(false)
  const animation_settling = ref(false)

  const on_animation_icon_enter = () => {
    animation_icon_hovered.value = true
    animation_settling.value = false
  }

  const play_animation_icon_settle = () => {
    if (!animation_icon_hovered.value) return
    animation_icon_hovered.value = false
    animation_settling.value = false
    requestAnimationFrame(() => {
      animation_settling.value = true
    })
  }

  /** @param {AnimationEvent} event */
  const on_animation_icon_animation_end = event => {
    if (event.animationName !== 'animation-ball-flourish-out') return
    animation_settling.value = false
  }

  const preferences_dialog = ref(null)
  const open_account = () => router.push('/account')
  provide('open_account', open_account)
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
    apply_aspect_ratio()
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
  register_preference('pref::Toggle_Grid', grid)
  register_preference('pref::Toggle_Menu', menu)
  register_preference('pref::Toggle_Footer', footer_visible)

  const apply_aspect_ratio = () => {
    document.documentElement.setAttribute(
      'data-aspect-ratio',
      aspect_ratio_mode.value || 'auto'
    )
  }

  watch(aspect_ratio_mode, apply_aspect_ratio, { immediate: true })

  register_preference('pref::Toggle_Bold', bold)
  register_preference('pref::Toggle_Medium', medium)
  register_preference('pref::Toggle_Regular', regular)
  register_preference('pref::Toggle_Light', light)

  register('pref::Toggle_View_3d', () => {
    view_3d.value = !view_3d.value
  })
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
  register('ui::Open_Account', open_account)
  register('ui::Clear_Sync_Time', () => {
    localStorage.removeItem('sync_time')
  })
  register('ui::Toggle_Presentation', () =>
    !document.fullscreenElement
      ? document.documentElement.requestFullscreen()
      : document.exitFullscreen()
  )

  register('nav::Go_Home', () => router.push('/'))
  register('nav::Go_Statements', () => router.push('/'))
  register('nav::Go_Thoughts', () => router.push('/'))
  register('nav::Go_Account', () => router.push('/account'))
  register('nav::Go_Docs', () => router.push('/docs'))
  register('nav::Go_About', () => router.push('/about'))
  register('nav::Go_Pricing', () => router.push('/pricing'))

  /** @param {boolean} active */
  const sync_active = active => set_working(active)
  const feed_needs_refresh = ref(0)
  provide('feed_needs_refresh', feed_needs_refresh)
  const on_sync_refreshed = () => {
    feed_needs_refresh.value = Date.now()
  }
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
  const go_to_thoughts_if_needed = () => {
    if (router.currentRoute.value.path !== '/') router.push('/')
  }
  /** @param {Event} event */
  const handle_add_change = event => {
    const input = /** @type {HTMLInputElement | null} */ (event.target)
    go_to_thoughts_if_needed()
    void paste_photo()
    select_photo()
    if (input) input.checked = false
  }
  /** @param {Event} event */
  const handle_camera_change = event => {
    const input = /** @type {HTMLInputElement | null} */ (event.target)
    go_to_thoughts_if_needed()
    open_camera()
    if (input) input.checked = false
  }
  /** @param {Event} event */
  const handle_view_3d_change = event => {
    const input = /** @type {HTMLInputElement | null} */ (event.target)
    const next_value = input?.checked ?? !view_3d.value
    view_3d.value = next_value
  }
  /**
   * Pull image blobs from clipboard on explicit user gesture.
   */
  const paste_photo = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return
    try {
      const clipboard_items = await navigator.clipboard.read()
      await queue_supported_clipboard_items(clipboard_items)
    } catch (error) {
      console.warn('Clipboard read failed:', error)
    }
  }
  /**
   * @param {DataTransferItem} item
   * @returns {Promise<string>}
   */
  const get_clipboard_item_string = item =>
    new Promise(resolve => {
      item.getAsString(value => resolve(value || ''))
    })
  /**
   * @param {string} data_url
   * @returns {Promise<File|null>}
   */
  const data_url_to_file = async data_url => {
    if (!data_url.startsWith('data:image/')) return null
    try {
      const response = await fetch(data_url)
      const blob = await response.blob()
      const mime = blob.type || 'image/png'
      const extension = mime.split('/')[1] || 'png'
      return new File([blob], `clipboard-${Date.now()}.${extension}`, {
        type: mime
      })
    } catch {
      return null
    }
  }
  /**
   * @param {ClipboardEvent} event
   * @returns {Promise<File[]>}
   */
  const get_clipboard_files = async event => {
    const files = Array.from(event.clipboardData?.files || [])
    if (files.length > 0) return files
    const items = Array.from(event.clipboardData?.items || [])
    const image_files = items
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(file => file instanceof File)
    if (image_files.length > 0) return image_files

    const html_item = items.find(
      item => item.kind === 'string' && item.type === 'text/html'
    )
    if (!html_item) return []
    const html = await get_clipboard_item_string(html_item)
    if (!html) return []

    const doc = new DOMParser().parseFromString(html, 'text/html')
    const image_sources = Array.from(doc.querySelectorAll('img'))
      .map(img => img.getAttribute('src') || '')
      .filter(src => src.startsWith('data:image/'))
    if (image_sources.length === 0) return []

    const converted = await Promise.all(image_sources.map(data_url_to_file))
    return converted.filter(file => file instanceof File)
  }
  /** @param {ClipboardEvent} event */
  const paste_image = async event => {
    const files = await get_clipboard_files(event)
    if (files.length === 0) return
    const queued = await queue_supported_files(files)
    if (queued) event.preventDefault()
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

    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    window.addEventListener('paste', paste_image)
  })
  dismount(() => {
    window.removeEventListener('online', online)
    window.removeEventListener('offline', offline)
    window.removeEventListener('paste', paste_image)
    dismount_vectorize()
  })
</script>

<template>
  <main id="realness" :class="[status, { posting }]">
    <teleport to="body">
      <working-border :active="status === 'working'" />
    </teleport>
    <support-layout />
    <sync @active="sync_active" @refreshed="on_sync_refreshed" />
    <as-fps v-if="info" />
    <footer
      v-if="menu && !storytelling"
      :data-footer-visible="footer_visible ? 'true' : 'false'">
      <nav aria-label="App actions">
        <label
          class="menu-action"
          :class="{ 'add-settling': add_settling }"
          aria-label="Add poster"
          @mouseenter="on_add_icon_enter"
          @mouseleave="play_add_icon_settle"
          @animationend="on_add_icon_animation_end">
          <input
            type="checkbox"
            switch
            aria-label="Add poster"
            @change="handle_add_change" />
          <span aria-hidden="true">
            <icon name="add" />
          </span>
        </label>

        <label
          class="menu-action"
          :class="{ active: view_3d }"
          aria-label="Toggle 3D">
          <input
            type="checkbox"
            switch
            :checked="view_3d"
            @change="handle_view_3d_change" />
          <span aria-hidden="true">
            <icon name="galaxy" />
          </span>
        </label>

        <label class="menu-action" aria-label="Open camera">
          <input
            type="checkbox"
            switch
            aria-label="Open camera"
            @change="handle_camera_change" />
          <span aria-hidden="true">
            <icon name="camera" />
            <svg viewBox="0 0 18 15" aria-hidden="true">
              <circle cx="9" cy="8" r="3" />
            </svg>
          </span>
        </label>
        <label
          class="menu-action"
          :class="{ active: animate, 'animation-settling': animation_settling }"
          aria-label="Toggle animation"
          @mouseenter="on_animation_icon_enter"
          @mouseleave="play_animation_icon_settle"
          @animationend="on_animation_icon_animation_end">
          <input
            type="checkbox"
            switch
            :checked="animate"
            @change="animate = !animate" />
          <span aria-hidden="true">
            <icon name="animation" />
          </span>
        </label>

        <as-dialog-preferences ref="preferences_dialog" />
      </nav>
      <label v-if="footer_toggle_shown">
        <input
          type="checkbox"
          switch
          role="switch"
          name="footer_visible"
          :checked="footer_visible"
          :aria-label="footer_visible ? 'Hide footer' : 'Show footer'"
          @change="on_footer_visible_change"
          @contextmenu.prevent />
        <span aria-hidden="true" />
      </label>
    </footer>

    <as-dialog-documentation ref="documentation" />
    <input
      ref="image_picker"
      class="poster picker"
      v-vectorizer
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/tiff,image/avif,image/heic,image/heif,.heic,.heif,image/svg+xml" />
  </main>
</template>

<style src="@/style/index.styl" lang="stylus"></style>

<style lang="stylus">

  @keyframes add-plus-pulse-twice {
    0% {
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    20% {
      transform: scale(1.1);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    40% {
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    60% {
      transform: scale(1.1);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    80% {
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes add-plus-flourish-out {
    0% {
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    50% {
      transform: scale(1.05);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes add-satellites-flourish-out {
    0% {
      opacity: 1;
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    100% {
      opacity: 0;
      transform: scale(0.5);
    }
  }

  @keyframes animation-ball-bounce {
    0% {
      transform: translate(0, 0) scale(1);
      animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    }
    28% {
      transform: translate(12%, -42%) scale(1.12);
      animation-timing-function: cubic-bezier(0.55, 0.06, 0.68, 0.19);
    }
    52% {
      transform: translate(-8%, 18%) scale(0.86, 1.14);
      animation-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
    }
    72% {
      transform: translate(5%, -10%) scale(1.06);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    88% {
      transform: translate(-2%, 5%) scale(0.98);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    100% {
      transform: translate(0, 0) scale(1);
    }
  }

  @keyframes animation-trail-mid-bounce {
    0% {
      transform: translate(0, 0) scale(1);
      animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    }
    28% {
      transform: translate(9%, -28%) scale(1.08);
      animation-timing-function: cubic-bezier(0.55, 0.06, 0.68, 0.19);
    }
    52% {
      transform: translate(-6%, 14%) scale(0.92, 1.08);
      animation-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
    }
    72% {
      transform: translate(4%, -7%) scale(1.03);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    88% {
      transform: translate(-2%, 3%) scale(0.99);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    100% {
      transform: translate(0, 0) scale(1);
    }
  }

  @keyframes animation-trail-old-bounce {
    0% {
      transform: translate(0, 0) scale(1);
      animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    }
    28% {
      transform: translate(6%, -18%) scale(1.05);
      animation-timing-function: cubic-bezier(0.55, 0.06, 0.68, 0.19);
    }
    52% {
      transform: translate(-4%, 10%) scale(0.94, 1.05);
      animation-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
    }
    72% {
      transform: translate(3%, -5%) scale(1.02);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    88% {
      transform: translate(-1%, 2%) scale(0.99);
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    100% {
      transform: translate(0, 0) scale(1);
    }
  }

  @keyframes animation-trail-old-flourish-out {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    42% {
      transform: translate(3%, -7%) scale(1.02);
    }
    72% {
      transform: translate(-1%, 2%) scale(0.99);
    }
  }

  @keyframes animation-trail-mid-flourish-out {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    42% {
      transform: translate(5%, -10%) scale(1.04);
    }
    72% {
      transform: translate(-2%, 3%) scale(0.99);
    }
  }

  @keyframes animation-ball-flourish-out {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    42% {
      transform: translate(7%, -15%) scale(1.06);
    }
    72% {
      transform: translate(-3%, 4%) scale(0.98);
    }
  }

  main#realness {
    border: (base-line / 16) solid transparent;
    border-radius: (base-line / 16);
    &.offline {
      border-color: var(--warning);
    }
    & > h6 {
      text-shadow: 1px 1px 1.25px var(--basalt);
      position: fixed;
      display: none;
      top: 0;
      left: var(--base-line);
    }

    & > footer {
      user-select: none;
      position: fixed;
      bottom: base-line;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: page-width;
      margin: (base-line * 0.25) auto;
      padding-inline: base-line;
      box-sizing: border-box;
      z-index: 9;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: base-line * 0.25;
      overflow: visible;

      /* Match footer_visible directly; do not rely on :has(label) because the
         toggle is v-if removed on / when focus is inside article.thought (and
         when fullscreen), which would otherwise leave the bar visible. */
      &[data-footer-visible='false'] > nav {
        transform: translateY(100%);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }

      & > label {
        disable-ios-touch-callout(true);
        touch-action: manipulation;
        pointer-events: auto !important;
        position: relative;
        z-index: 10;
        display: block;
        width: base-line * 4;
        height: base-line * 0.5;
        padding: 0;
        margin: 0;
        cursor: pointer;
        pointer-events: auto;
        & > input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          cursor: pointer;
          z-index: 1;
          &:focus,
          &:focus-visible {
            outline: none;
            box-shadow: none;
          }
        }
        & > span {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: base-line;
          outline: 2px solid var(--emphasis);
          outline-offset: base-line * 0.25;
          transition: background-color 0.2s ease;
          frosted-glass();
          box-shadow: 0 0 base-line var(--basalt-transparent);
          pointer-events: none;
        }
        &:hover > span {
          background-color: var(--basalt);
        }
      }

      & > nav {
        width: 100%;
        margin: base-line * 0.5;
        frosted-glass();
        border-radius: base-line;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: base-line;
        padding: base-line * 0.5;
        pointer-events: none;
        transition: transform 0.25s ease, opacity 0.25s ease, visibility 0.25s;
        transition-behavior: allow-discrete;
        & > * {
          pointer-events: auto;
        }
        & a[aria-label='Settings'],
        & button[aria-label='Settings'],
        & label.menu-action,
        & label[for='wat'],
        & a[aria-label='Go to thoughts'] {
          position: static;
          color: var(--accent);
          cursor: pointer;
          border: none;
          background: transparent;
          padding: 0;
          margin: 0;
          box-shadow: none;
          transform: none;
          appearance: none;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          &:active {
            transform: none;
          }
          svg {
            fill: var(--accent);
          }
          svg.animation {
            stroke: var(--accent);
          }
          &:focus,
          &:focus-visible {
            outline: none;
            box-shadow: none;
          }
        }
        & label.menu-action.active {
          color: var(--emphasis);
          svg {
            fill: var(--emphasis);
          }
          svg.animation {
            stroke: var(--emphasis);
          }
        }
        & label.menu-action {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          & > input {
            position: absolute;
            inset: 0;
            margin: 0;
            opacity: 0;
            cursor: pointer;
            &:focus,
            &:focus-visible {
              outline: none;
              box-shadow: none;
            }
          }
          & > span {
            pointer-events: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          & svg.icon {
            transition-timing-function: ease;
            transition-duration: 1.66s;
            transition-property: transform;
            @media (prefers-reduced-motion: reduce) {
              transition-duration: 0.01ms;
            }
          }
          &:active svg.icon {
            outline: none;
          }
          &[aria-label='Toggle animation'] svg.animation {
            .animation-ball,
            .animation-trail-mid,
            .animation-trail-old {
              transform: translate(0, 0) scale(1);
              transition-property: transform;
              transition-timing-function: ease;
              transition-duration: 2.2s;
              @media (prefers-reduced-motion: reduce) {
                transition-duration: 0.01ms;
              }
            }
            .animation-trail-old {
              transition-delay: 0s;
            }
            .animation-trail-mid {
              transition-delay: 0.16s;
            }
            .animation-ball {
              transition-delay: 0.32s;
            }
          }
          &[aria-label='Add poster'] svg.add {
            .add-plus {
              transform: scale(1);
              transition-property: transform;
              transition-timing-function: ease;
              transition-duration: 0.65s;
              @media (prefers-reduced-motion: reduce) {
                transition-duration: 0.01ms;
              }
            }
            .add-satellites {
              opacity: 0;
              transition-property: opacity, transform;
              transition-timing-function: ease;
              transition-duration: 0.4s;
              @media (prefers-reduced-motion: reduce) {
                transition-duration: 0.01ms;
              }
              .add-sat {
                transition-property: transform;
                transition-timing-function: ease;
                transition-duration: 0.4s;
                @media (prefers-reduced-motion: reduce) {
                  transition-duration: 0.01ms;
                }
              }
            }
          }
          &[aria-label='Open camera'] svg.camera {
            transition-duration: 0.4s;
          }
          &.add-settling svg.add {
            .add-plus {
              transition: none;
              animation: add-plus-flourish-out 0.55s cubic-bezier(0.45, 0, 0.55, 1);
              @media (prefers-reduced-motion: reduce) {
                animation: none;
              }
            }
            .add-satellites {
              transition: none;
              animation: add-satellites-flourish-out 0.45s cubic-bezier(0.45, 0, 0.55, 1) forwards;
              .add-sat-tl {
                transform: translate(-22%, -22%) scale(0.85);
              }
              .add-sat-tr {
                transform: translate(22%, -22%) scale(0.85);
              }
              .add-sat-bl {
                transform: translate(-22%, 22%) scale(0.85);
              }
              .add-sat-br {
                transform: translate(22%, 22%) scale(0.85);
              }
              @media (prefers-reduced-motion: reduce) {
                animation: none;
              }
            }
          }
          &.animation-settling svg.animation {
            .animation-ball,
            .animation-trail-mid,
            .animation-trail-old {
              transition: none;
            }
            .animation-trail-old {
              animation: animation-trail-old-flourish-out 0.55s cubic-bezier(0.34, 1.45, 0.64, 1);
            }
            .animation-trail-mid {
              animation: animation-trail-mid-flourish-out 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) 0.1s;
            }
            .animation-ball {
              animation: animation-ball-flourish-out 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) 0.2s;
            }
            @media (prefers-reduced-motion: reduce) {
              .animation-ball,
              .animation-trail-mid,
              .animation-trail-old {
                animation: none;
              }
            }
          }
          @media (hover: hover) and (pointer: fine) {
            &[aria-label='Add poster']:hover svg.add {
              .add-plus {
                transition: none;
                animation: add-plus-pulse-twice 1.3s linear;
              }
              .add-satellites {
                opacity: 1;
                .add-sat-tl {
                  transform: translate(-22%, -22%) scale(0.85);
                }
                .add-sat-tr {
                  transform: translate(22%, -22%) scale(0.85);
                }
                .add-sat-bl {
                  transform: translate(-22%, 22%) scale(0.85);
                }
                .add-sat-br {
                  transform: translate(22%, 22%) scale(0.85);
                }
              }
              @media (prefers-reduced-motion: reduce) {
                .add-plus {
                  animation: none;
                  transform: scale(0.95);
                }
                .add-satellites {
                  opacity: 0;
                }
              }
            }
            &[aria-label='Toggle 3D']:hover svg.galaxy {
              transform: rotate(72deg) scale(0.95);
              transition-duration: 0.45s;
            }
            &[aria-label='Open camera']:hover svg.camera {
              transform: scale(1.08);
              transition-duration: 0.4s;
            }
            &[aria-label='Open camera']:hover span svg:last-child circle {
              transform: scale(0);
            }

            &[aria-label='Toggle animation']:hover svg.animation {
              .animation-ball,
              .animation-trail-mid,
              .animation-trail-old {
                transition: none;
              }
            }
            &[aria-label='Toggle animation']:hover svg.animation .animation-ball {
              animation: animation-ball-bounce 0.98s linear;
            }
            &[aria-label='Toggle animation']:hover svg.animation .animation-trail-mid {
              animation: animation-trail-mid-bounce 0.98s linear 0.16s;
            }
            &[aria-label='Toggle animation']:hover svg.animation .animation-trail-old {
              animation: animation-trail-old-bounce 0.98s linear 0.32s;
            }
            &[aria-label='Toggle animation']:hover svg.animation {
              @media (prefers-reduced-motion: reduce) {
                .animation-ball,
                .animation-trail-mid,
                .animation-trail-old {
                  animation: none;
                  transform: scale(0.95);
                }
              }
            }
          }
          &[aria-label='Toggle animation']:active svg.animation {
            .animation-ball,
            .animation-trail-mid,
            .animation-trail-old {
              transition: none;
            }
          }
          &[aria-label='Add poster']:active svg.add {
            .add-plus {
              transition: none;
              animation: add-plus-pulse-twice 0.95s linear;
            }
            .add-satellites {
              opacity: 1;
              .add-sat-tl {
                transform: translate(-30%, -30%) scale(0.75);
              }
              .add-sat-tr {
                transform: translate(30%, -30%) scale(0.75);
              }
              .add-sat-bl {
                transform: translate(-30%, 30%) scale(0.75);
              }
              .add-sat-br {
                transform: translate(30%, 30%) scale(0.75);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .add-plus {
                animation: none;
                transform: scale(0.92);
              }
              .add-satellites {
                opacity: 0;
              }
            }
          }
          &[aria-label='Open camera']:active svg.camera {
            transform: scale(0.9);
            transition-duration: 0.22s;
          }
          &[aria-label='Open camera']:active span svg:last-child circle {
            transform: scale(0);
            transition-duration: 0.15s;
          }

          &[aria-label='Toggle animation']:active svg.animation .animation-ball {
            animation: animation-ball-bounce 0.64s linear;
          }
          &[aria-label='Toggle animation']:active svg.animation .animation-trail-mid {
            animation: animation-trail-mid-bounce 0.64s linear 0.11s;
          }
          &[aria-label='Toggle animation']:active svg.animation .animation-trail-old {
            animation: animation-trail-old-bounce 0.64s linear 0.22s;
          }
          &[aria-label='Toggle animation']:active svg.animation {
            @media (prefers-reduced-motion: reduce) {
              .animation-ball,
              .animation-trail-mid,
              .animation-trail-old {
                animation: none;
                transform: scale(0.95);
              }
            }
          }
        }
        & a[aria-label='Settings'],
        & button[aria-label='Settings'] {
          & svg.icon {
            transition-timing-function: ease;
            transition-duration: 1.66s;
            transition-property: transform;
            @media (prefers-reduced-motion: reduce) {
              transition-duration: 0.01ms;
            }
          }
          @media (hover: hover) and (pointer: fine) {
            &:hover svg.gear {
              transform: rotate(60deg) scale(0.95);
            }
          }
          &:active svg.gear {
            transform: rotate(-60deg) scale(1.05);
            transition-duration: 0.66s;
          }
        }
        & a[aria-label='Settings'] svg,
        & button[aria-label='Settings'] svg,
        & label.menu-action:not([aria-label='Open camera']) svg {
          width: base-line * 1.15;
          height: base-line * 1.15;
        }
        & label.menu-action[aria-label='Open camera'] svg {
          width: base-line * 2;
          height: base-line * 2;
        }
        & label.menu-action[aria-label='Open camera'] span {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          & > svg:first-child {
            width: base-line * 2;
            height: base-line * 2;
          }
          & > svg:last-child {
            position: absolute;
            inset: 0;
            width: base-line * 2;
            height: base-line * 2;
            pointer-events: none;
            circle {
              fill: currentColor;
              transform-box: fill-box;
              transform-origin: 9px 8px;
              transform: scale(1);
              transition-property: transform;
              transition-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
              transition-duration: 0.35s;
              @media (prefers-reduced-motion: reduce) {
                transition-duration: 0.01ms;
              }
            }
          }
        }

      }

    }
  }

  @starting-style {
    main#realness > footer > nav {
      transform: translateY(100%);
      opacity: 0;
      visibility: hidden;
    }
  }
</style>
