<script setup>
  import {
    build_download_svg,
    prepare_poster_svg_for_3d,
    get_filename_for_poster
  } from '@/utils/export-poster'
  import { as_query_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import { get_live_poster_scene } from '@/3d/scenes/live-poster-scene.js'
  import { with_poster_scene } from '@/3d/scenes/with-poster-scene.js'
  import {
    render_svg_layers_to_psd,
    extract_all_layers
  } from '@/utils/svg-to-psd'
  import { render_complete_poster_to_canvas } from '@/utils/poster-canvas'
  import {
    render_svg_to_video_blob,
    download_video
  } from '@/utils/svg-to-video'
  import { VIDEO_EXPORT_ANIMATION_SPEED } from '@/utils/animation-config'
  import {
    begin_poster_video_export,
    end_poster_video_export
  } from '@/use/poster-video-export'
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

  const on_download_svg = event => {
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

  const on_toggle_menu = event => {
    event.preventDefault()
    event.stopPropagation()
    if (video_exporting.value) return
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
        background: var(--emphasis);
        color: var(--bone);
        text-decoration: none;
        border-radius: 0.5rem;
        z-index: 6;
        font-size: 1.2rem;
        font-weight: bold;
        box-shadow: 0 4px 12px unquote('color-mix(in srgb, var(--moonlight) 30%, transparent)');
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

  const on_download_psd = async event => {
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

  const on_download_video = async event => {
    event.preventDefault()
    event.stopPropagation()

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    const viewbox = svg.viewBox.baseVal
    const aspect_ratio = viewbox.width / viewbox.height
    const target_smallest_side = 1440
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
    begin_poster_video_export()

    try {
      const video_filename = await get_filename_for_poster(props.itemid, 'mov')
      const blob = await render_svg_to_video_blob(svg, {
        animation_speed: VIDEO_EXPORT_ANIMATION_SPEED,
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
      end_poster_video_export()
      video_exporting.value = false
      video_progress.value = 0
      video_total.value = 0
      set_working(false)
      close_menu()
    }
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

  const on_png_layers = async event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    set_working(true)

    try {
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
        // oxlint-disable-next-line no-await-in-loop
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
    } finally {
      set_working(false)
    }
  }

  const on_download_png = async event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    set_working(true)

    try {
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
    } finally {
      set_working(false)
    }
  }

  const on_download_glb = async event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()

    const svg_el = document.getElementById(as_query_id(props.itemid))
    if (!svg_el || !(svg_el instanceof SVGSVGElement)) return

    set_working(true)

    const { itemid } = props
    const filename = file_name.value?.replace('.svg', '') || 'poster'
    const live_scene = get_live_poster_scene(itemid)

    try {
      if (live_scene) {
        await live_scene.wait_for_textures()
        live_scene.export_glb(filename)
        return
      }

      const svg_string = await prepare_poster_svg_for_3d(svg_el, itemid)
      await with_poster_scene(svg_string, async scene => {
        await scene.wait_for_textures()
        scene.export_glb(filename)
      })
    } finally {
      set_working(false)
    }
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
    <a @click="on_toggle_menu" title="Download" aria-label="Download options">
      <icon name="download" />
    </a>
    <menu v-if="menu_open" ref="menu_ref" class="format-picker">
      <a v-if="!video_exporting" @click="on_download_svg" title="Download SVG">
        SVG
      </a>
      <a
        v-if="!video_exporting"
        @click="on_download_png"
        title="Download PNG"
        aria-label="Download full poster as PNG">
        <icon name="add" @click="on_png_layers" />
        PNG
      </a>
      <a
        v-if="!video_exporting"
        @click="on_download_psd"
        title="Download PSD"
        aria-label="Download PSD">
        PSD
      </a>
      <a
        v-if="!video_exporting"
        @click="on_download_video"
        title="Download video"
        aria-label="Download animated video">
        Video
      </a>
      <a
        v-if="!video_exporting"
        @click="on_download_glb"
        title="Download GLB for Blender"
        aria-label="Download GLB for Blender">
        GLB
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

    menu.format-picker {
      position: absolute;
      bottom: 100%;
      right: 0;
      left: auto;
      margin-bottom: base-line * 0.25;
      max-width: min(calc(100vw - var(--base-line) * 4), base-line * 15);
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: flex-start;
      align-items: center;
      font-size: larger;
      gap: base-line * 0.25;
      padding: base-line * 0.25;
      frosted-glass();
      border-radius: base-line * 0.25;
      z-index: 6;
      & > a {
        position: relative;
        padding: base-line * 0.25 base-line * 0.5;
        border-radius: base-line * 0.125;
        white-space: nowrap;
        cursor: pointer;

        &:hover {
          background: var(--accent);
          color: var(--on-emphasis);
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
