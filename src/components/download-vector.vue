<script setup>
  import { as_day_and_time } from '@/utils/date'
  import { hsl_to_hex } from '@/utils/color-converters'
  import { hsla_to_color } from '@/utils/colors'
  import { load, as_query_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import {
    render_svg_layers_to_psd,
    extract_all_layers
  } from '@/utils/svg-to-psd'
  import icon from '@/components/icon'
  import { ref, inject, onMounted as on_mounted, onUnmounted as on_unmounted, h, createApp } from 'vue'
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

  const normalize_ids_for_download = svg => {
    const id_map = new Map()

    const all_elements = svg.querySelectorAll('[id]')
    all_elements.forEach(el => {
      const old_id = el.getAttribute('id')
      if (!old_id) return

      const itemprop = el.getAttribute('itemprop')
      let new_id = null

      if (itemprop) {
        const layer_names = [
          'light',
          'regular',
          'medium',
          'bold',
          'sediment',
          'sand',
          'gravel',
          'rocks',
          'boulders',
          'shadow',
          'background'
        ]
        if (layer_names.includes(itemprop)) new_id = itemprop
      }

      if (!new_id) {
        const itemid = el.getAttribute('itemid')
        if (itemid) {
          const parts = itemid.split('/')
          if (parts.length >= 3) {
            const [, , layer_type] = parts
            const layer_names = [
              'shadows',
              'sediment',
              'sand',
              'gravel',
              'rocks',
              'boulders'
            ]
            if (layer_names.includes(layer_type))
              new_id = layer_type === 'shadows' ? 'shadows' : layer_type
          }
        }
      }

      if (new_id && new_id !== old_id) {
        id_map.set(old_id, new_id)
        el.setAttribute('id', new_id)
      }
    })

    const href_elements = svg.querySelectorAll('[href]')
    href_elements.forEach(el => {
      const href = el.getAttribute('href')
      if (href && href.startsWith('#')) {
        const old_id = href.substring(1)
        const new_id = id_map.get(old_id)
        if (new_id) el.setAttribute('href', `#${new_id}`)
      }
    })

    const url_attrs = ['fill', 'stroke', 'mask']
    url_attrs.forEach(attr => {
      const elements = svg.querySelectorAll(`[${attr}]`)
      elements.forEach(el => {
        const value = el.getAttribute(attr)
        if (value && value.includes('url(#')) {
          const match = value.match(/url\(#([^)]+)\)/)
          if (match) {
            const [, old_id] = match
            const new_id = id_map.get(old_id)
            if (new_id)
              el.setAttribute(
                attr,
                value.replace(`url(#${old_id})`, `url(#${new_id})`)
              )
          }
        }
      })
    })
  }

  const build_download_svg = svg_element => {
    const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))

    const use_elements = svg_clone.querySelectorAll('use[href]')
    const referenced_ids = new Set()
    use_elements.forEach(use_el => {
      const href = use_el.getAttribute('href')
      if (href && href.startsWith('#')) referenced_ids.add(href.substring(1))
    })

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
          const symbol_id = symbol.getAttribute('id')
          if (symbol_id && referenced_ids.has(symbol_id)) {
            const symbol_clone = /** @type {SVGSymbolElement} */ (
              symbol.cloneNode(true)
            )
            defs.appendChild(symbol_clone)
          }
        })
      }
    }

    const hidden_elements = svg_clone.querySelectorAll(
      '[style*="visibility: hidden"]'
    )
    hidden_elements.forEach(el => {
      el.remove()
    })

    const style_elements = svg_clone.querySelectorAll('[style]')
    style_elements.forEach(el => {
      el.removeAttribute('style')
    })

    const vue_components = svg_clone.querySelectorAll('as-animation')
    vue_components.forEach(component => component.remove())

    svg_clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    normalize_ids_for_download(svg_clone)

    if (localStorage.adobe) adobe(svg_clone)

    return svg_clone
  }

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

  const adobe = svg => {
    const convert = svg.querySelectorAll('[stop-color]')
    convert.forEach(element => {
      const hsla = element.getAttribute('stop-color')
      const c = hsla_to_color(hsla)
      element.setAttribute('stop-color', hsl_to_hex(c.h, c.s, c.l))
    })
  }

  const get_vector_name = async () => {
    const info = props.itemid.split('/')
    const author_id = `/${info[1]}`
    const time = as_day_and_time(Number(info[3]))
    const creator = await load(author_id)
    const facts = `${time}.svg`
    if (creator?.name) {
      const safe_name = creator.name.replace(/\s+/g, '_')
      return `${safe_name}_${facts}`
    }
    return facts
  }

  const get_psd_name = async () => {
    const info = props.itemid.split('/')
    const author_id = `/${info[1]}`
    const time = as_day_and_time(Number(info[3]))
    const creator = await load(author_id)
    const facts = `${time}.psd`
    if (creator?.name) {
      const safe_name = creator.name.replace(/\s+/g, '_')
      return `${safe_name}_${facts}`
    }
    return facts
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
    if (
      menu_open.value &&
      menu_ref.value &&
      button_ref.value &&
      !menu_ref.value.contains(event.target) &&
      !button_ref.value.contains(event.target)
    )
      close_menu()
  }

  const download_psd = async (svg_element, filename, buffer) => {
    let psd_buffer = buffer
    let psd_filename = filename

    if (!psd_buffer) {
      set_working(true)
      psd_filename = filename || (await get_psd_name())
      psd_buffer = await render_svg_layers_to_psd(svg_element, props.itemid)
      set_working(false)
    }

    const blob = new Blob([psd_buffer], { type: 'image/vnd.adobe.photoshop' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = psd_filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const download_psd_handler = async event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    await download_psd(svg)
  }

  const render_complete_poster_to_canvas = async (svg_element, width, height) => {
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

    const icon_size = Math.round(width * 0.02)
    const icon_padding = Math.round(width * 0.01)
    await draw_icon_on_canvas(ctx, 'realness', icon_padding, icon_padding, icon_size)

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
    file_name.value = await get_vector_name()
    document.addEventListener('click', handle_click_outside)
  })

  on_unmounted(() => {
    document.removeEventListener('click', handle_click_outside)
  })
</script>

<template>
  <nav ref="button_ref">
    <a
      @click="toggle_menu"
      title="Download"
      aria-label="Download options">
      <icon name="download" />
    </a>
    <menu v-if="menu_open" ref="menu_ref">
      <a @click="download_svg_handler" title="Download SVG">SVG</a>
      <a
        @click="download_png_handler"
        title="Download PNG"
        aria-label="Download full poster as PNG">
        <icon name="add" @click="png_layers" />
        PNG
      </a>
      <a
        @click="download_psd_handler"
        title="Download PSD"
        aria-label="Download PSD">
        PSD
      </a>
    </menu>
  </nav>
</template>

<style lang="stylus">
  nav {
    position: relative;

    & > a:first-child {
      display: block;
    }

    menu {
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: base-line * 0.25;
      display: flex;
      font-size: larger;
      flex-direction: column;
      gap: base-line * 0.25;
      padding: base-line * 0.25;
      background: black-transparent;
      border-radius: base-line * 0.25;
      standard-shadow: boop;
      z-index: 10;
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
    }
  }
</style>
