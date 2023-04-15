import { useActiveElement as active_element, whenever } from '@vueuse/core'
import { ref, onMounted as mounted } from 'vue'
import { change } from '@/use/opacity'
export const svg_ns = 'http://www.w3.org/2000/svg'
export const change_by = 0.08
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
const opacity_percentage = ref()
const selected_path = ref()
const as_stroke = ref(false)
export const use = () => {
  const fill_opacity = change_by => {
    const path = get_active_path()
    path.style.fillOpacity = change(path.style.fillOpacity, change_by)
  }

  const stroke_opacity = change_by => {
    const path = get_active_path()
    path.style.strokeOpacity = change(path.style.strokeOpacity, change_by)
  }

  const opacity = change_by => {
    const path = get_active_path()
    path.style.opacity = change(path.style.opacity, change_by)
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
    const path_name = path.getAttribute('itemprop')
    if (path_name) {
      selected_path.value = path_name
      if (as_stroke.value) opacity_percentage.value = path.style.strokeOpacity
      else opacity_percentage.value = path.style.fillOpacity
    }
    return path
  }

  mounted(() => {
    selected_path.value = null
    opacity_percentage.value = null
    as_stroke.value = false
  })

  whenever(opacity_percentage, () => {
    const path = itemprop_query(selected_path.value)
    if (as_stroke.value) path.style.strokeOpacity = opacity_percentage.value
    else path.style.fillOpacity = opacity_percentage.value
  })

  return {
    as_stroke,
    fill_opacity,
    stroke_opacity,
    opacity,
    opacity_percentage,
    selected_path,
    get_active_path
  }
}
