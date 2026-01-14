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
  import { ref, onMounted, onUnmounted } from 'vue'

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
  const downloading_psd = ref(false)
  const downloading_pngs = ref(false)
  const menu_open = ref(false)
  const menu_ref = ref(null)
  const button_ref = ref(null)

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
      downloading_psd.value = true
      psd_filename = filename || (await get_psd_name())
      psd_buffer = await render_svg_layers_to_psd(svg_element, props.itemid)
      downloading_psd.value = false
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
    if (downloading_psd.value) return

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    await download_psd(svg)
  }

  const download_png_handler = async event => {
    event.preventDefault()
    event.stopPropagation()
    close_menu()
    if (downloading_pngs.value) return

    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    downloading_pngs.value = true

    const layers = await extract_all_layers(svg, props.itemid)
    const base_name = file_name.value?.replace('.svg', '') || 'layer'

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      const canvas = new OffscreenCanvas(
        layer.imageData.width,
        layer.imageData.height
      )
      const ctx = canvas.getContext('2d')
      ctx.putImageData(layer.imageData, 0, 0)

      // eslint-disable-next-line no-await-in-loop
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${base_name}-${layer.name.toLowerCase()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    // eslint-disable-next-line require-atomic-updates
    downloading_pngs.value = false
  }

  onMounted(async () => {
    file_name.value = await get_vector_name()
    document.addEventListener('click', handle_click_outside)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handle_click_outside)
  })
</script>

<template>
  <div class="download-menu" ref="button_ref">
    <a
      class="download-toggle"
      @click="toggle_menu"
      :class="{
        working: downloading_psd || downloading_pngs
      }"
      title="Download"
      :aria-label="
        downloading_psd || downloading_pngs
          ? 'Generating...'
          : 'Download options'
      ">
      <icon name="download" />
    </a>
    <menu v-if="menu_open" ref="menu_ref" class="download-options">
      <a @click="download_svg_handler" title="Download SVG">SVG</a>
      <a
        @click="download_png_handler"
        :class="{ working: downloading_pngs }"
        title="Download PNG"
        :aria-label="
          downloading_pngs ? 'Generating PNGs...' : 'Download layers as PNG'
        ">
        PNG
      </a>
      <a
        @click="download_psd_handler"
        :class="{ working: downloading_psd }"
        title="Download PSD"
        :aria-label="downloading_psd ? 'Generating PSD...' : 'Download PSD'">
        PSD
      </a>
    </menu>
  </div>
</template>

<style lang="stylus">
  .download-menu {
    position: relative;

    .download-toggle {
      &.working {
        animation-name: working;
      }
    }

    .download-options {
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: base-line * 0.25;
      display: flex;
      flex-direction: column;
      gap: base-line * 0.25;
      padding: base-line * 0.5;
      background: black-transparent;
      border-radius: base-line * 0.25;
      standard-shadow: boop;
      z-index: 10;

      a {
        padding: base-line * 0.25 base-line * 0.5;
        border-radius: base-line * 0.125;
        white-space: nowrap;
        cursor: pointer;

        &:hover {
          background: green;
          color: white;
        }

        &.working {
          animation-name: working;
        }
      }
    }
  }
</style>
