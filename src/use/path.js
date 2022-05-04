import { useActiveElement as active_element } from '@vueuse/core'
import { ref, onMounted as mounted } from 'vue'
import { change } from '@/use/opacity'
import { luminosity } from '@/use/colors'
export const svg_ns = 'http://www.w3.org/2000/svg'

export const is_path = path => {
  if (typeof path != 'object') return false
  if (path instanceof SVGPathElement) return true
  else return false
}

export const itemprop_query = name => {
  return document.querySelector(`[itemprop="${name}"]`)
}

export const create_path_element = () => {
  return document.createElementNS(svg_ns, 'path')
}

export const create_stop_element = () => {
  return document.createElementNS(svg_ns, 'stop')
}

const opacity_percentage = ref()
const selected_path = ref()

export const use = () => {
  const fill_opacity = resolution => {
    const path = get_active_path()
    path.style.fillOpacity = change(path.style.fillOpacity, resolution)
  }

  const stroke_opacity = resolution => {
    const path = get_active_path()
    path.style.strokeOpacity = change(path.style.strokeOpacity, resolution)
  }

  const opacity = resolution => {
    const path = get_active_path()
    path.style.opacity = change(path.style.opacity, resolution)
  }

  const color_luminosity = amount => {
    const path = get_active_path()
    const color = path.style.color
    const changed = luminosity(color, amount)
    path.style.color = changed.color
  }

  const get_active_path = () => {
    let path = active_element().value
    if (!is_path(path)) {
      const href = active_element().value.href
      if (href) {
        const id = href.baseVal.slice(1)
        const symbol = document.getElementById(id)
        path = symbol.firstChild
      }
    }

    selected_path.value = path.getAttribute('itemprop')
    opacity_percentage.value = path.style.fillOpacity
    return path
  }

  mounted(() => {
    selected_path.value = null
    opacity_percentage.value = null
  })
  return {
    fill_opacity,
    opacity_percentage,
    selected_path,
    stroke_opacity,
    color_luminosity,
    opacity,
    get_active_path
  }
}
