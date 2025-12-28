import { whenever } from '@vueuse/core'
import { ref, onMounted as mounted } from 'vue'
import { change } from '@/utils/opacity'
import { svg_ns, use as use_path } from '@/use/path'
export const change_by = 0.08

export const use = () => {
  const { get_active_path } = use_path()
  const fill_opacity = change_by => {
    const layer = get_active_layer()
    layer.style.fillOpacity = change(layer.style.fillOpacity, change_by)
  }
  const stroke_opacity = change_by => {
    const layer = get_active_layer()
    layer.style.strokeOpacity = change(layer.style.strokeOpacity, change_by)
  }
  const opacity = change_by => {
    const layer = get_active_layer()
    layer.style.opacity = change(layer.style.opacity, change_by)
  }

  const get_active_layer = () => {
    const path = get_active_path()

    const layer_name = path.getAttribute('itemprop')
    if (layer_name) {
      selected_layer.value = layer_name
      const layer = settings_query(layer_name)
      if (as_stroke.value) opacity_percentage.value = layer.style.strokeOpacity
      else opacity_percentage.value = layer.style.fillOpacity
      return layer
    }
  }

  mounted(() => {
    selected_layer.value = null
    opacity_percentage.value = null
    as_stroke.value = false
  })

  whenever(opacity_percentage, () => {
    const layer = settings_query(selected_layer.value)
    if (as_stroke.value) layer.style.strokeOpacity = opacity_percentage.value
    else layer.style.fillOpacity = opacity_percentage.value
  })

  return {
    as_stroke,
    fill_opacity,
    stroke_opacity,
    opacity,
    opacity_percentage,
    selected_layer,
    get_active_layer
  }
}

export const is_use = path => {
  if (typeof path !== 'object') return false
  if (path instanceof SVGUseElement) return true
  return false
}
export const is_url_query = _query => true
export const settings_query = name => {
  const settings = document.querySelector('[itemscope][itemtype=/settings]')
  return settings.querySelector(`[itemprop="${name}"]`)
}

export const create_use_element = () => document.createElementNS(svg_ns, 'use')

const opacity_percentage = ref()
const selected_layer = ref()
const as_stroke = ref(false)
