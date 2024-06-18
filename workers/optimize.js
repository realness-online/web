import { optimize } from 'svgo/dist/svgo.browser.js'
const options = {
  multipass: true,
  full: true,
  js2svg: {
    indent: 2,
    pretty: true
  },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeUnknownsAndDefaults: false,
          removeViewBox: false,
          removeEmptyAttrs: false,
          mergePaths: false,
          convertPathData: {
            floatPrecision: 0,
            transformPrecision: 0,
            makeArcs: {
              threshold: 0.5, // coefficient of rounding error
              tolerance: 25.0 // percentage of radius
            }
          }
        }
      }
    }
  ]
}
export function listen(message) {
  console.log('before', `${to_kb(message.data.vector)}kb`)
  const optimized = optimize(message.data.vector, options)
  console.log('after', `${to_kb(optimized.data)}kb`)
  self.postMessage({ vector: optimized.data })
}
self.addEventListener('message', listen)

function to_kb(object) {
  return (object.length / 1024).toFixed(2)
}
