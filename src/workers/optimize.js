import SVGO from 'svgo'
const options = {
  multipass: true,
  full: true,
  plugins: [
    {
      convertPathData: {
        floatPrecision: 0,
        transformPrecision: 0,
        makeArcs: {
          threshold: 0.5, // coefficient of rounding error
          tolerance: 25.0 // percentage of radius
        }
      }
    },
    { cleanupNumericValues: true },
    { cleanupAttrs: true },
    { removeEmptyAttrs: true },
    { removeViewBox: false },
    { removeUselessStrokeAndFill: true },
    { sortAttrs: false },
    { mergePaths: false }
  ]
}
export async function listen(message) {
  const svgo = new SVGO(options)
  console.log('before', `${to_kb(message.data.vector)}kb`)
  const optimized = await svgo.optimize(message.data.vector)
  console.log('after', `${to_kb(optimized.data)}kb`)
  self.postMessage({ vector: optimized.data })
}
self.addEventListener('message', listen)

function to_kb(object) {
  return (object.length / 1024).toFixed(2)
}
