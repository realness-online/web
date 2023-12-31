import { trace } from 'vtracer'
import { to_kb } from 'size-image'
export const listen = async message => {
  console.time('make:vector-tracer')
  const image = message.data.image
  console.log('image', image, image.bitmap.width, image.bitmap.height)
  const paths = trace(image)
  console.log('size', to_kb(paths))
  self.postMessage({ paths })
  console.timeEnd('vector-tracer')
}
self.addEventListener('message', listen)
