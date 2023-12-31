import { ColorImageConverter as trace } from 'vtracer'
import { to_kb } from './image.js'
export const listen = async message => {
  console.time('vtracer:vector')
  const image = message.data.bitmap
  console.log('bitmap', image, image.width, image.height)
  const paths = trace(image)
  console.log('vtracer:size', to_kb(paths))
  self.postMessage({ paths })
  console.timeEnd('vtracer:vector')
}
self.addEventListener('message', listen)
