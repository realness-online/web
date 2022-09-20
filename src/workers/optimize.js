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
          cleanupAttrs: true,
          cleanupNumericValues: true,
          removeViewBox: false,
          removeEmptyAttrs: false,
          removeUselessStrokeAndFill: true,
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
export async function listen(message) {
  console.info('before', `${to_kb(message.data.vector)}kb`)
  const optimized = optimize(message.data.vector, options)
  console.info('after', `${to_kb(optimized.data)}kb`)
  self.postMessage({ vector: optimized.data })
}
self.addEventListener('message', listen)

function to_kb(object) {
  return (object.length / 1024).toFixed(2)
}
