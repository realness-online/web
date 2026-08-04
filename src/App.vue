<script setup>
  import sync from '@/components/sync'
  import { defineAsyncComponent as define_async_component } from 'vue'
  const AsDialogPreferences = define_async_component(
    () => import('@/components/profile/as-dialog-preferences.vue')
  )
  const AsDialogDocumentation = define_async_component(
    () => import('@/components/as-dialog-documentation.vue')
  )
  const AsNotificationPrompt = define_async_component(
    () => import('@/components/profile/as-notification-prompt.vue')
  )
  const AsFps = define_async_component(() => import('@/components/as-fps.vue'))
  import WorkingBorder from '@/components/working-border.vue'
  import SupportLayout from '@/components/support-layout'
  import icon from '@/components/icon'
  import {
    ref,
    computed,
    onUnmounted as unmounted,
    onMounted as mounted,
    provide
  } from 'vue'
  import { useFps, useFullscreen, useActiveElement } from '@vueuse/core'
  import { useRouter as use_router } from 'vue-router'
  import { use_global_keymap } from '@/use/global-keymap'
  import { use_icon_settle } from '@/use/icon-settle'
  import { get_clipboard_files } from '@/utils/clipboard-images'
  import { use_vectorize_deferred } from '@/use/vectorize-deferred'
  import { posting } from '@/use/posting'
  import {
    drama,
    drama_back,
    drama_front,
    animate,
    info,
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

  // Stub directive — the real change listener is attached when the vectorize
  // module loads. Named vVectorizer so <script setup> registers it as
  // v-vectorizer and the template compiles without a resolve warning.
  const vVectorizer = {}

  const {
    image_picker,
    new_vector,
    current_processing,
    queue_items,
    select_photo,
    open_camera,
    queue_supported_files,
    queue_supported_clipboard_items,
    init_processing_queue
  } = use_vectorize_deferred()

  provide('image-picker', image_picker)
  provide('new_vector', new_vector)
  provide('current_processing', current_processing)
  provide('open_camera', open_camera)
  provide('select_photo', select_photo)
  provide('init_processing_queue', init_processing_queue)
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

  const {
    settling: add_settling,
    enter: on_add_enter,
    leave: on_add_leave,
    end: on_add_animation_end
  } = use_icon_settle({ animation: 'add-plus-flourish-out' })

  // The ball and both trails ride one keyframe; the ball is last out.
  const {
    settling: animation_settling,
    enter: on_animation_enter,
    leave: on_animation_leave,
    end: on_animation_animation_end
  } = use_icon_settle({
    animation: 'animation-flourish-out',
    part: 'animation-ball'
  })

  const preferences_dialog = ref(null)
  const open_account = () => router.push('/account')
  provide('open_account', open_account)
  use_global_keymap({
    documentation,
    preferences: preferences_dialog
  })

  /** @param {boolean} active */
  const on_active = active => set_working(active)
  /** @type {import('vue').Ref<import('@/types').Feed_Refresh | null>} */
  const feed_needs_refresh = ref(null)
  provide('feed_needs_refresh', feed_needs_refresh)
  /** @param {import('@/types').Feed_Refresh} [detail] Which authors sync changed; absent means all of them */
  const on_sync_refreshed = detail => {
    feed_needs_refresh.value = { at: Date.now(), ...detail }
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
  const on_add_change = event => {
    const input = /** @type {HTMLInputElement | null} */ (event.target)
    go_to_thoughts_if_needed()
    void paste_photo()
    select_photo()
    if (input) input.checked = false
  }
  /** @param {Event} event */
  const on_camera_change = event => {
    const input = /** @type {HTMLInputElement | null} */ (event.target)
    go_to_thoughts_if_needed()
    open_camera()
    if (input) input.checked = false
  }
  /** @param {Event} event */
  const on_view_3d_change = event => {
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
  /** @param {ClipboardEvent} event */
  const paste_image = async event => {
    const files = await get_clipboard_files(event)
    if (files.length === 0) return
    const queued = await queue_supported_files(files)
    if (queued) event.preventDefault()
  }
  /** @param {DragEvent} event */
  const drop_image = async event => {
    if (!event.dataTransfer?.files?.length) return
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    await queue_supported_files(files)
  }
  /** @param {DragEvent} event */
  const allow_drop = event => event.preventDefault()

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
    window.addEventListener('dragover', allow_drop)
    window.addEventListener('drop', drop_image)
  })
  unmounted(() => {
    window.removeEventListener('online', online)
    window.removeEventListener('offline', offline)
    window.removeEventListener('paste', paste_image)
    window.removeEventListener('dragover', allow_drop)
    window.removeEventListener('drop', drop_image)
  })
</script>

<template>
  <main
    id="realness"
    :data-offline="status === 'offline' || undefined"
    :data-posting="posting || undefined">
    <teleport to="body">
      <working-border :active="status === 'working'" />
    </teleport>
    <support-layout />
    <sync @active="on_active" @refreshed="on_sync_refreshed" />
    <as-fps v-if="info" />
    <footer
      v-if="menu"
      :data-footer-visible="footer_visible ? 'true' : 'false'">
      <nav aria-label="App actions">
        <label
          :data-settling="add_settling || undefined"
          aria-label="Add poster"
          @mouseenter="on_add_enter"
          @mouseleave="on_add_leave"
          @animationend="on_add_animation_end">
          <input
            type="checkbox"
            switch
            aria-label="Add poster"
            @change="on_add_change" />
          <span aria-hidden="true">
            <icon name="add" />
          </span>
        </label>

        <label aria-label="Toggle 3D">
          <input
            type="checkbox"
            switch
            :checked="view_3d"
            @change="on_view_3d_change" />
          <span aria-hidden="true">
            <icon name="galaxy" />
          </span>
        </label>

        <label aria-label="Open camera">
          <input
            type="checkbox"
            switch
            aria-label="Open camera"
            @change="on_camera_change" />
          <span aria-hidden="true">
            <icon name="camera" />
            <svg viewBox="0 0 18 15" aria-hidden="true">
              <circle cx="9" cy="8" r="3" />
            </svg>
          </span>
        </label>
        <label
          :data-settling="animation_settling || undefined"
          aria-label="Toggle animation"
          @mouseenter="on_animation_enter"
          @mouseleave="on_animation_leave"
          @animationend="on_animation_animation_end">
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
    <as-notification-prompt />
    <input
      ref="image_picker"
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

  /* These three are mixins because hover is gated behind a hover-capable
     pointer and press is not, so the two triggers cannot share a rule. */
  satellites-out() {
    .add-sat {
      transform: translate(var(--dx), var(--dy)) scale(var(--sat-scale));
    }
  }

  pulse-plus() {
    .add-plus {
      transition: none;
      animation: add-plus-pulse-twice var(--pulse) linear;
    }
  }

  bounce-parts() {
    transition: none;
    animation-name: animation-bounce;
    animation-duration: var(--bounce);
    animation-timing-function: linear;
    animation-delay: var(--delay-out);
  }

  /* One arc, scaled per part by the --amplitude it declares. */
  @keyframes animation-bounce {
    0% {
      transform: translate(0, 0) scale(1);
      animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    }
    28% {
      transform: translate(calc(12% * var(--amplitude)), calc(-42% * var(--amplitude))) scale(calc(1 + 0.12 * var(--amplitude)));
      animation-timing-function: cubic-bezier(0.55, 0.06, 0.68, 0.19);
    }
    52% {
      transform: translate(calc(-8% * var(--amplitude)), calc(18% * var(--amplitude))) scale(calc(1 - 0.14 * var(--amplitude)), calc(1 + 0.14 * var(--amplitude)));
      animation-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
    }
    72% {
      transform: translate(calc(5% * var(--amplitude)), calc(-10% * var(--amplitude))) scale(calc(1 + 0.06 * var(--amplitude)));
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    88% {
      transform: translate(calc(-2% * var(--amplitude)), calc(5% * var(--amplitude))) scale(calc(1 - 0.02 * var(--amplitude)));
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    }
    100% {
      transform: translate(0, 0) scale(1);
    }
  }

  @keyframes animation-flourish-out {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    42% {
      transform: translate(calc(7% * var(--amplitude)), calc(-15% * var(--amplitude))) scale(calc(1 + 0.06 * var(--amplitude)));
    }
    72% {
      transform: translate(calc(-3% * var(--amplitude)), calc(4% * var(--amplitude))) scale(calc(1 - 0.02 * var(--amplitude)));
    }
  }

  main#realness {
    border: (base-line / 16) solid transparent;
    border-radius: (base-line / 16);
    &[data-offline] {
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
      bottom: base-line * 1.5;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: page-width;
      margin: 0 auto;
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
        cursor: pointer;
        pointer-events: auto;
        & > input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
          z-index: 1;
          &:focus,
          &:focus-visible {
            outline: none;
            box-shadow: none;
          }
          &:focus-visible + span {
            outline-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent);
          }
        }
        & > span {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: base-line;
          outline: 2px solid var(--emphasis);
          outline-offset: base-line * 0.25;
          transition: background-color 0.2s ease, box-shadow 0.2s ease;
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
        margin: base-line (base-line * 0.5);
        frosted-glass();
        border-radius: base-line;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: base-line;
        padding: (base-line * 0.5) (base-line * 0.5);
        pointer-events: none;
        transition: transform 0.25s ease, opacity 0.25s ease, visibility 0.25s;
        transition-behavior: allow-discrete;
        & > * {
          pointer-events: auto;
        }
        & a[aria-label='Settings'],
        & button[aria-label='Settings'],
        & > label,
        & label[for='wat'],
        & a[aria-label='Go to thoughts'] {
          position: static;
          color: var(--accent);
          cursor: pointer;
          border: none;
          background: transparent;
          padding: 0;
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
          &:focus {
            outline: none;
            box-shadow: none;
          }
          focus-ring();
        }
        /* icon.vue paints with currentColor, so color is the whole story. */
        & > label:has(input:checked) {
          color: var(--emphasis);
        }
        & > label {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          & > input {
            position: absolute;
            inset: 0;
            opacity: 0;
            cursor: pointer;
            &:focus,
            &:focus-visible {
              outline: none;
              box-shadow: none;
            }
            &:focus-visible + span {
              outline: 2px solid var(--accent);
              outline-offset: 2px;
              border-radius: base-line * 0.25;
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
          &:has(svg.animation) {
            svg.animation {
              --settle: 2.2s;
              --bounce: 0.98s;
              --flourish: 0.55s;
              --spring: cubic-bezier(0.34, 1.45, 0.64, 1);
              --stagger: 0.16s;
              /* The ball leads going out and lands last coming back. */
              .animation-ball {
                --amplitude: 1;
                --out: 0;
                --back: 2;
              }
              .animation-trail-mid {
                --amplitude: 0.7;
                --out: 1;
                --back: 1;
              }
              .animation-trail-old {
                --amplitude: 0.5;
                --out: 2;
                --back: 0;
              }
              & > * {
                --delay-out: calc(var(--out) * var(--stagger));
                --delay-back: calc(var(--back) * var(--stagger));
                transform: translate(0, 0) scale(1);
                transition-property: transform;
                transition-duration: var(--settle);
                transition-timing-function: ease;
                transition-delay: var(--delay-back);
              }
            }
            @media (hover: hover) and (pointer: fine) {
              &:hover svg.animation > * {
                bounce-parts();
              }
            }
            &:active svg.animation {
              --bounce: 0.64s;
              --stagger: 0.11s;
              & > * {
                bounce-parts();
              }
            }
            &[data-settling] svg.animation {
              --stagger: 0.1s;
              & > * {
                transition: none;
                animation-name: animation-flourish-out;
                animation-duration: var(--flourish);
                animation-timing-function: var(--spring);
                animation-delay: var(--delay-back);
              }
            }
            /* No travel, but a hover and a press still say they landed. */
            @media (prefers-reduced-motion: reduce) {
              svg.animation {
                --settle: 0.01ms;
                --stagger: 0s;
              }
              &:hover svg.animation > *,
              &:active svg.animation > * {
                animation: none;
                transform: scale(0.95);
              }
              &[data-settling] svg.animation > * {
                animation: none;
              }
            }
          }
          &:has(svg.add) {
            svg.add {
              --pulse: 1.3s;
              --reach: 22%;
              --sat-scale: 0.85;
              --still: 0.95;
              .add-plus {
                transform: scale(1);
                transition: transform 0.65s ease;
              }
              .add-satellites {
                opacity: 0;
                transition: opacity 0.4s ease, transform 0.4s ease;
              }
              /* Which corner each satellite makes for. */
              .add-sat-tl {
                --x: -1;
                --y: -1;
              }
              .add-sat-tr {
                --x: 1;
                --y: -1;
              }
              .add-sat-bl {
                --x: -1;
                --y: 1;
              }
              .add-sat-br {
                --x: 1;
                --y: 1;
              }
              .add-sat {
                --dx: calc(var(--reach) * var(--x));
                --dy: calc(var(--reach) * var(--y));
                transition: transform 0.4s ease;
              }
            }
            @media (hover: hover) and (pointer: fine) {
              &:hover svg.add {
                pulse-plus();
                .add-satellites {
                  opacity: 1;
                }
                satellites-out();
              }
            }
            /* A press throws them further and lands them smaller. */
            &:active svg.add {
              --pulse: 0.95s;
              --reach: 30%;
              --sat-scale: 0.75;
              --still: 0.92;
              pulse-plus();
              .add-satellites {
                opacity: 1;
              }
              satellites-out();
            }
            &[data-settling] svg.add {
              .add-plus {
                transition: none;
                animation-name: add-plus-flourish-out;
                animation-duration: 0.55s;
                animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
              }
              .add-satellites {
                transition: none;
                animation-name: add-satellites-flourish-out;
                animation-duration: 0.45s;
                animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
                animation-fill-mode: forwards;
              }
              satellites-out();
            }
            @media (prefers-reduced-motion: reduce) {
              svg.add .add-plus,
              svg.add .add-satellites,
              svg.add .add-sat {
                transition-duration: 0.01ms;
              }
              &:hover svg.add,
              &:active svg.add {
                .add-plus {
                  animation: none;
                  transform: scale(var(--still));
                }
                .add-satellites {
                  opacity: 0;
                }
              }
              &[data-settling] svg.add {
                .add-plus,
                .add-satellites {
                  animation: none;
                }
              }
            }
          }
          &:has(svg[data-icon='camera']) {
            svg[data-icon='camera'] {
              transition-duration: 0.4s;
            }
            /* The focus ring inside the lens closes as the camera reacts. */
            @media (hover: hover) and (pointer: fine) {
              &:hover svg[data-icon='camera'] {
                transform: scale(1.08);
              }
              &:hover span svg:not(.icon) circle {
                transform: scale(0);
              }
            }
            &:active svg[data-icon='camera'] {
              transform: scale(0.9);
              transition-duration: 0.22s;
            }
            &:active span svg:not(.icon) circle {
              transform: scale(0);
              transition-duration: 0.15s;
            }
          }
          @media (hover: hover) and (pointer: fine) {
            &:hover svg[data-icon='galaxy'] {
              transform: rotate(72deg) scale(0.95);
              transition-duration: 0.45s;
            }
          }
        }
        & a:has(svg[data-icon='gear']),
        & button:has(svg[data-icon='gear']) {
          & svg.icon {
            transition-timing-function: ease;
            transition-duration: 1.66s;
            transition-property: transform;
            @media (prefers-reduced-motion: reduce) {
              transition-duration: 0.01ms;
            }
          }
          @media (hover: hover) and (pointer: fine) {
            &:hover svg[data-icon='gear'] {
              transform: rotate(60deg) scale(0.95);
            }
          }
          &:active svg[data-icon='gear'] {
            transform: rotate(-60deg) scale(1.05);
            transition-duration: 0.66s;
          }
        }
        & a[aria-label='Settings'] svg,
        & button[aria-label='Settings'] svg,
        & > label:not([aria-label='Open camera']) svg {
          width: base-line * 1.15;
          height: base-line * 1.15;
        }
        & > label[aria-label='Open camera'] svg {
          width: base-line * 2;
          height: base-line * 2;
        }
        & > label[aria-label='Open camera'] span {
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
