// A ```mermaid fence builds to <pre class="mermaid">. Load mermaid only on
// pages that have one, themed from the stylesheet's own colors.
import { size_diagrams } from './plan-diagrams.js'

const plans = document.documentElement.dataset.site === 'plans'
const diagrams = [...document.querySelectorAll('pre.mermaid')]
if (plans) diagrams.sort((a, b) => Number(!!b.closest('article > figure')) - Number(!!a.closest('article > figure')))

// Mermaid's color parser rejects modern formats such as oklch(), so paint each
// value and read the sRGB pixel back. An unpaintable value samples as black,
// which mermaid accepts.
const to_hex = (value) => {
  if (!value) return value
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')
  context.fillStyle = '#000'
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

if (diagrams.length) {
  // A failed load or render must not leave the body hidden; reveal the raw
  // fence text rather than a blank page.
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/scripts/mermaid.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.append(script)
    })
    // mermaid has no theme that follows the OS, so read the page's colors
    const css = getComputedStyle(document.documentElement)
    const color = name => to_hex(css.getPropertyValue(name).trim())
    const surface = color('--surface')
    const text = color('--text')
    const line = color('--accent') || color('--blue')
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        fontFamily: getComputedStyle(document.body).fontFamily,
        background: surface,
        primaryColor: surface,
        primaryTextColor: text,
        primaryBorderColor: line,
        lineColor: line,
        textColor: text,
        nodeBorder: line,
        clusterBkg: surface,
        clusterBorder: line
      },
      flowchart: { curve: 'basis', padding: 12 }
    })
    await window.mermaid.run({ nodes: diagrams })
    if (plans) size_diagrams(diagrams)
  } finally {
    // The body is hidden while `data-diagrams` is pending; the raw fence text
    // must never paint. Clear it once every diagram is drawn.
    document.documentElement.dataset.diagrams = 'ready'
  }
}
