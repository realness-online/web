import { useActiveElement as active_element } from '@vueuse/core'
import { ref } from 'vue'
import { change } from '@/use/opacity'
import { luminosity } from '@/use/colors'
export const svg_ns = 'http://www.w3.org/2000/svg'

export const itemprop_query = name => {
  return document.querySelector(`[itemprop="${name}"]`)
}

export const create_path_element = () => {
  return document.createElementNS(svg_ns, 'path')
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
    const id = active_element().value.href.baseVal.slice(1)
    const symbol = document.getElementById(id)
    const path = symbol.firstChild
    console.log('howdy', path)
    selected_path.value = path.getAttribute('itemprop')
    opacity_percentage.value = path.style.fillOpacity
    return path
  }

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
