import { as_paths } from '@realness.online/potrace'
const potrace_options = {
  turdSize: 40,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: 'dominant',
  rangeDistribution: 'auto',
  steps: 3
  // threshold: 255
}

export function read_exif(file) {
  const reader = new FileReaderSync()
  return reader.readAsArrayBuffer(file)
}

export async function make(image) {
  let poster = await as_paths(image, potrace_options)
  return {
    light: poster.paths[0],
    regular: poster.paths[1],
    bold: poster.paths[2],
    width: poster.width,
    height: poster.height,
    viewbox: `0 0 ${poster.width} ${poster.height}`
  }
}
export async function listen(message) {
  console.time('make:vector')
  const vector = await make(message.data.image)
  self.postMessage({ vector })
  console.timeEnd('make:vector')
}
self.addEventListener('message', listen)
