export function change_color(id, color, type = 'fill') {
  const path = get_path_element(id)
  path.setAttribute(type, color)
}

export function get_color(id, type = 'fill') {
  return get_path_element(id).getAttribute(`${type}`)
}

export function get_path_element(id) {
  return document.getElementById(id).querySelector('path')
}

export function get_path_attribute(id, type = 'fill') {
  return get_path_element(id).getAttribute(`${type}`)
}

export default change_color
