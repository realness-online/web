<script setup>
  import {
    build_download_svg,
    get_filename_for_poster
  } from '@/utils/export-poster'
  import { as_query_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import {
    render_svg_layers_to_psd,
    extract_all_layers
  } from '@/utils/svg-to-psd'
  import {
    render_svg_to_video_blob,
    download_video
  } from '@/utils/svg-to-video'
  import { animation_speed } from '@/utils/preference'
  import icon from '@/components/icon'
  import {
    ref,
    inject,
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    h,
    createApp
  } from 'vue'
  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })

  defineOptions({
    name: 'DownloadVector'
  })

  const file_name = ref(null)
  const menu_open = ref(false)
  const menu_ref = ref(null)
  const button_ref = ref(null)
  const set_working = inject('set_working')
  const video_exporting = ref(false)
  const video_progress = ref(0)
  const video_total = ref(0)

  const download_svg_handler = event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()
    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    const download_svg = build_download_svg(svg)
    const svg_string = new XMLSerializer().serializeToString(download_svg)
    const blob = new Blob([svg_string], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file_name.value
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const toggle_menu = event => {
    event.preventDefault()
    event.stopPropagation()
    menu_open.value = !menu_open.value
  }

  const close_menu = () => {
    menu_open.value = false
  }

  const handle_click_outside = event => {
    if (video_exporting.value) return
    if (
      menu_open.value &&
      menu_ref.value &&
      button_ref.value &&
      !menu_ref.value.contains(event.target) &&
      !button_ref.value.contains(event.target)
    )
      close_menu()
  }

  const is_ios_safari = () => {
    const ua = navigator.userAgent
    const is_ios = /iPad|iPhone|iPod/.test(ua)
    const is_safari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)
    return is_ios && is_safari
  }

  const download_psd = async (svg_element, filename, buffer) => {
    const is_ios = is_ios_safari()

    let psd_buffer = buffer
    let psd_filename = filename

    if (!psd_buffer) {
      set_working(true)

      try {
        psd_filename =
          filename || (await get_filename_for_poster(props.itemid, 'psd'))
        const target_width = is_ios_safari() ? null : undefined
        psd_buffer = await render_svg_layers_to_psd(
          svg_element,
          props.itemid,
          target_width
        )
      } catch (error) {
        console.error('[PSD Download] PSD generation failed:', error)
        console.error('[PSD Download] Error stack:', error.stack)
        set_working(false)
        return
      }
      set_working(false)
    }

    const blob = new Blob([psd_buffer], { type: 'image/vnd.adobe.photoshop' })

    const url = URL.createObjectURL(blob)

    if (is_ios) {
      try {
        const new_window = window.open(url, '_blank')

        if (new_window) return
      } catch (error) {
        console.error('[PSD Download] window.open failed:', error)
      }

      const a = document.createElement('a')
      a.href = url
      a.download = psd_filename
      a.target = '_blank'

      a.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 1rem 2rem;
        background: red;
        color: white;
        text-decoration: none;
        border-radius: 0.5rem;
        z-index: 6;
        font-size: 1.2rem;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `
      a.textContent = `Tap to download ${psd_filename}`
      a.id = 'ios-psd-download-link'

      document.body.appendChild(a)

      try {
        a.click()
      } catch (error) {
        console.error('[PSD Download] Programmatic click failed:', error)
      }
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = psd_filename
      document.body.appendChild(a)

      try {
        a.click()
      } catch (error) {
        console.error('[PSD Download] Standard download failed:', error)
      }

      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const download_psd_handler = async event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) {
      console.error('[PSD Download] SVG element not found', {
        query_id: as_query_id(props.itemid)
      })
      return
    }

    await download_psd(svg)
  }

  const download_video_handler = async event => {
    event.preventDefault()
    event.stopPropagation()

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    const viewbox = svg.viewBox.baseVal
    const aspect_ratio = viewbox.width / viewbox.height
    const target_smallest_side = 1080
    const video_width =
      aspect_ratio >= 1
        ? Math.round(target_smallest_side * aspect_ratio)
        : target_smallest_side
    const video_height =
      aspect_ratio >= 1
        ? target_smallest_side
        : Math.round(target_smallest_side / aspect_ratio)

    video_exporting.value = true
    video_progress.value = 0
    video_total.value = 0
    set_working(true)
    svg.unpauseAnimations()

    try {
      const video_filename = await get_filename_for_poster(props.itemid, 'mov')
      const blob = await render_svg_to_video_blob(svg, {
        fps: 24,
        animation_speed: animation_speed.value,
        width: video_width,
        height: video_height,
        suggested_filename: video_filename,
        on_progress: (frame, total) => {
          video_progress.value = frame
          video_total.value = total
        }
      })
      download_video(blob, video_filename)
    } catch (error) {
      console.error('Failed to render video:', error)
    } finally {
      video_exporting.value = false
      video_progress.value = 0
      video_total.value = 0
      set_working(false)
      close_menu()
    }
  }

  const render_complete_poster_to_canvas = async (
    svg_element,
    width,
    height
  ) => {
    const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))

    const hidden_elements = svg_clone.querySelectorAll(
      '[style*="visibility: hidden"]'
    )
    hidden_elements.forEach(el => el.remove())

    const vue_components = svg_clone.querySelectorAll('as-animation')
    vue_components.forEach(component => component.remove())

    svg_clone.setAttribute('width', String(width))
    svg_clone.setAttribute('height', String(height))
    svg_clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    const figure = svg_element.closest('figure.poster')
    if (figure) {
      const hidden_svg = figure.querySelector('svg[style*="display: none"]')
      if (hidden_svg) {
        const symbols = hidden_svg.querySelectorAll('symbol')
        let defs = svg_clone.querySelector('defs')
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
          svg_clone.appendChild(defs)
        }
        symbols.forEach(symbol => {
          const symbol_clone = symbol.cloneNode(true)
          defs.appendChild(symbol_clone)
        })
      }
    }

    const svg_data = new XMLSerializer().serializeToString(svg_clone)
    const svg_blob = new Blob([svg_data], { type: 'image/svg+xml' })
    const svg_url = URL.createObjectURL(svg_blob)

    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = svg_url
    })

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)
    URL.revokeObjectURL(svg_url)

    return canvas
  }

  const draw_icon_on_canvas = async (ctx, icon_name, x, y, size) => {
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    document.body.appendChild(container)

    const app = createApp({
      render: () => h(icon, { name: icon_name })
    })
    app.mount(container)

    const icon_element = container.querySelector('svg.icon')
    if (!icon_element) {
      app.unmount()
      document.body.removeChild(container)
      return
    }

    icon_element.setAttribute('width', String(size))
    icon_element.setAttribute('height', String(size))

    const icon_svg_string = new XMLSerializer().serializeToString(icon_element)
    const icon_blob = new Blob([icon_svg_string], { type: 'image/svg+xml' })
    const icon_url = URL.createObjectURL(icon_blob)

    const icon_img = new Image()
    await new Promise((resolve, reject) => {
      icon_img.onload = resolve
      icon_img.onerror = reject
      icon_img.src = icon_url
    })

    ctx.save()
    ctx.globalAlpha = 0.7
    ctx.drawImage(icon_img, x, y, size, size)
    ctx.restore()

    URL.revokeObjectURL(icon_url)
    app.unmount()
    document.body.removeChild(container)
  }

  const png_layers = async event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    set_working(true)

    const viewbox = svg.viewBox.baseVal
    const aspect_ratio = viewbox.width / viewbox.height
    const FOUR_K_WIDTH = 3840
    const width = FOUR_K_WIDTH
    const height = Math.round(FOUR_K_WIDTH / aspect_ratio)

    const layers = await extract_all_layers(svg, props.itemid, FOUR_K_WIDTH)

    const base_name = file_name.value?.replace('.svg', '') || 'poster'

    for (const layer of layers) {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      ctx.putImageData(layer.imageData, 0, 0)

      // Sequential processing required for file downloads
      // eslint-disable-next-line no-await-in-loop
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safe_layer_name = layer.name.toLowerCase().replace(/\s+/g, '_')
      a.download = `${base_name}_${safe_layer_name}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    set_working(false)
  }

  const download_png_handler = async event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    set_working(true)

    const viewbox = svg.viewBox.baseVal
    const aspect_ratio = viewbox.width / viewbox.height
    const FOUR_K_WIDTH = 3840
    const width = FOUR_K_WIDTH
    const height = Math.round(FOUR_K_WIDTH / aspect_ratio)

    const canvas = await render_complete_poster_to_canvas(svg, width, height)
    const ctx = canvas.getContext('2d')

    const ICON_SIZE_RATIO = 0.02
    const ICON_PADDING_RATIO = 0.01
    const icon_size = Math.round(width * ICON_SIZE_RATIO)
    const icon_padding = Math.round(width * ICON_PADDING_RATIO)
    await draw_icon_on_canvas(
      ctx,
      'realness',
      icon_padding,
      icon_padding,
      icon_size
    )

    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const base_name = file_name.value?.replace('.svg', '') || 'poster'
    a.download = `${base_name}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    set_working(false)
  }

  on_mounted(async () => {
    file_name.value = await get_filename_for_poster(props.itemid, 'svg')
    document.addEventListener('click', handle_click_outside)
  })

  on_unmounted(() => {
    document.removeEventListener('click', handle_click_outside)
  })
</script>

<template>
  <nav class="download-vector" ref="button_ref">
    <a @click="toggle_menu" title="Download" aria-label="Download options">
      <icon name="download" />
    </a>
    <menu v-if="menu_open" ref="menu_ref">
      <a
        v-if="!video_exporting"
        @click="download_svg_handler"
        title="Download SVG">
        SVG
      </a>
      <a
        v-if="!video_exporting"
        @click="download_png_handler"
        title="Download PNG"
        aria-label="Download full poster as PNG">
        <icon name="add" @click="png_layers" />
        PNG
      </a>
      <a
        v-if="!video_exporting"
        @click="download_psd_handler"
        title="Download PSD"
        aria-label="Download PSD">
        PSD
      </a>
      <a
        v-if="!video_exporting"
        @click="download_video_handler"
        title="Download video"
        aria-label="Download animated video">
        Video
      </a>
      <span v-else class="video-progress">
        {{ video_progress }}/{{ video_total }} frames
      </span>
    </menu>
  </nav>
</template>

<style lang="stylus">
  nav.download-vector {
    position: relative;

    & > a:first-child {
      display: block;
    }

    menu {
      position: absolute;
      bottom: 100%;
      left: 0;
      margin-bottom: base-line * 0.25;
      max-width: min(calc(100vw - base-line * 4), base-line * 15);
      display: flex;
      flex-direction: column;
      font-size: larger;
      gap: base-line * 0.25;
      padding: base-line * 0.25;
      background: black-transparent;
      border-radius: base-line * 0.25;
      standard-shadow: boop;
      z-index: 6;
      & > a {
        position: relative;
        padding: base-line * 0.25 base-line * 0.5;
        border-radius: base-line * 0.125;
        white-space: nowrap;
        cursor: pointer;

        &:hover {
          background: green;
          color: white;
        }

        & > svg.icon,
        & > icon {
          position: absolute;
          top: base-line * 0.15;
          left: base-line * 0.15;
          width: base-line * 0.5;
          height: base-line * 0.5;
          cursor: pointer;
          pointer-events: auto;
          z-index: 1;
        }
      }

      .video-progress {
        padding: base-line * 0.25 base-line * 0.5;
        opacity: 0.9;
      }
    }
  }
</style>
