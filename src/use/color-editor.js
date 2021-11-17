export function change_color(id, color, type = 'fill') {
  const path = get_path_element(id)
  path.setAttribute(type, color)
}

export function get_color(id, type = 'fill') {
  return get_path_element(id).getAttribute(`${type}`)
}

export function get_path_element(id) {
  console.log('dude', id)
  console.log(document.getElementById(id).children[0])
  return document.getElementById(id).children[0]
}

export function get_use_element(id) {
  const query = `use[href='#${id}']`
  console.log(query)
  return document.querySelector(query)
}

export function get_path_attribute(id, type = 'fill') {
  return get_path_element(id).getAttribute(`${type}`)
}

export default change_color
