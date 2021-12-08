//See https://github.com/sindresorhus/rgb-hex
export default function rgb_to_hex(red, green, blue) {
  const isPercent = red.toString().includes('%')

  if (typeof red === 'string') {
    ;[red, green, blue] = red
      .match(/(0?\.?\d{1,3})%?\b/g)
      .map(component => Number(component))
  }
  if (
    typeof red !== 'number' ||
    typeof green !== 'number' ||
    typeof blue !== 'number' ||
    red > 255 ||
    green > 255 ||
    blue > 255
  ) {
    throw new TypeError('Expected three numbers below 256')
  }

  return (
    '#' + (blue | (green << 8) | (red << 16) | (1 << 24)).toString(16).slice(1)
  )
}
