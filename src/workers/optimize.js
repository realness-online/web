import SVGO from 'svgo'
const options = {
  multipass: true,
  full: true,
  plugins: [
    { cleanupAttrs: true },
    { removeEmptyAttrs: true },
    { removeViewBox: false },
    { convertPathData: { floatPrecision: 0 } },
    { removeUselessStrokeAndFill: true },
    { cleanupNumericValues: true },
    { sortAttrs: false },
    { mergePaths: false },
    { removeAttrs: { attrs: '(stroke|fill)' } }
  ]
}
export async function listen (message) {
  const svgo = new SVGO(options)
  const optimized = await svgo.optimize(message.data.vector)
  self.postMessage({ vector: optimized.data })
}
self.addEventListener('message', listen)
