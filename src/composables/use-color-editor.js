export default function change_color (id, type = 'fill') {
  const path = get_path_element(id)
  path.setAttribute(type, value)
  emit(`change-${type}`)
}

export function get_path_element (id) {
  return document.getElementById(id).querySelector('*')
}

export function get_path_attribute (id, type = 'fill') {
  return this.get_path_element(id).getAttribute(`${type}`)
}
