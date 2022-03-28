import Jimp from 'jimp'

export const is_stop = stop => {
  if (!stop.unit) return false
  if (!stop.number) return false
  if (!stop.color) return false
  return true
}


export const as_gradient = image => {
  const width = image.bitmap.width
  const height = image.bitmap.height
  const chunk = resolve_fidelity(width, {number:25, unit:'%'})
  const stops = []
  const colour_stop = factory(width)

  for (let i = 0; i < width; i += chunk) {
    let color = image
      .clone()
      .crop(i, 0, chunk, height)
      .resize(1, 1, Jimp.default.RESIZE_BICUBIC)
      .getPixelColor(0, 0)
    color = rgb_to_hex(Jimp.default.intToRGBA(color))
    stops.push(colour_stop(color, i))
  }
  return gradient(stops)
}

export const factory = width => {
  return function colour_stop(colour, index) {
    return { colour, position: scale(index, 0, width) }
  }
}

export const resolve_fidelity = (length, pair = { number: 8.3325, unit:'%' }) => {
  if (!pair) throw new Error('Expects <number> or <percentage> for fidelity')
  const number = parseFloat(pair.number)
  if (number === 0) throw new Error('Expected a fidelity greater than 0.')
  if (pair.unit === '%') return length * (number / 100)
  return number
}

export const rgb_to_hex = ({ r, g, b }) => {
  function convert(c) {
    const hex = c.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return '#' + convert(r) + convert(g) + convert(b)
}

export const gradient = stops => {
  const figured = stops
    .map(stop => `${stop.colour} ${stop.position}%`)
    .join(', ')
  return `linear-gradient(90deg, ${figured})`
}

export const scale = (value, min, max) => {
  const new_min = 0
  const new_max = 100
  const percent = (value - min) / (max - min)
  return percent * (new_max - new_min) + new_min
}
