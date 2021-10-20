export function fill_lighter () {
  change_opacity()
}
export function fill_less () {
  this.change_opacity('less')
}
export function subtle_fill_less () {
  this.change_opacity('less', 'fill', 0.01)
}
export function subtle_fill_darker () {
  this.change_opacity('less', 'fill', 0.01)
}
export default function change_opacity (direction = 'more', type = 'fill', resolution = 0.025) {
  if (!document.activeElement) return
  let fragment = document.activeElement.getAttribute('href')
  fragment = fragment.substring(1)
  const symbols = this.$el.querySelectorAll('symbol')
  symbols.forEach(symbol => {
    const id = symbol.getAttribute('id')
    if (id === fragment) {
      const path = symbol.querySelector('path')
      let opacity = path.getAttribute(`${type}-opacity`)

      if (!opacity || opacity === 'NaN') opacity = 0.5
      opacity = parseFloat(opacity)
      opacity = opacity * 10000
      opacity = Math.round(opacity)
      opacity = opacity / 10000

      if (direction === 'less') opacity += resolution
      else opacity -= resolution

      if (opacity > 0.9) opacity = 0.8
      else if (opacity < 0) opacity = 0.025

      path.setAttribute(`${type}-opacity`, opacity)
      this.$emit('change-opacity')
    }
  })
}
