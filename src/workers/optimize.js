import SVGO from 'svgo'
const svgo_options = {
  multipass: true,
  full: true,
  plugins: [
    { cleanupAttrs: true },
    { removeEmptyAttrs: true },
    { removeViewBox: false },
    { convertPathData: true },
    { removeUselessStrokeAndFill: true },
    { cleanupNumericValues: true },
    { sortAttrs: false },
    { removeAttrs: { attrs: '(stroke|fill)' } }
  ]
}
export async function message_listener (message) {
  const svgo = new SVGO(svgo_options)
  const vector = await svgo.optimize(message.data.vector)
  self.postMessage({ vector })
}
self.addEventListener('message', message_listener)
