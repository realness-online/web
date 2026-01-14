<script setup>
  import { as_day_and_time } from '@/utils/date'
  import { hsl_to_hex } from '@/utils/color-converters'
  import { hsla_to_color } from '@/utils/colors'
  import { load, as_query_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import icon from '@/components/icon'
  import { ref, onMounted } from 'vue'

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

    if (localStorage.adobe) adobe(svg_clone)

    return svg_clone
  }

  const download = event => {
    event.preventDefault()
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

  onMounted(async () => {
    file_name.value = await get_vector_name()
  })
</script>

<template>
  <a class="download" @click="download">
    <icon name="download" />
  </a>
</template>

<style lang="stylus">
  a.download.working {
    animation-name: working;
  }
</style>
