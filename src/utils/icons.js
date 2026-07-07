import icons_svg from '../../public/icons.svg?raw'

/** @param {string} svg */
export const icon_names_from_svg = svg =>
  [...svg.matchAll(/<symbol[^>]*\sid="([^"]+)"/g)].map(([, id]) => id)

export const icon_names = icon_names_from_svg(icons_svg)
