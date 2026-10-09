// A ```mermaid fence builds to <pre class="mermaid">. Load mermaid only on
// pages that have one, themed from the stylesheet's own colors.
import { size_diagrams } from './plan-diagrams.js'
import { draw_diagrams } from './parts.js'

const plans = document.documentElement.dataset.site === 'plans'
const diagrams = [...document.querySelectorAll('pre.mermaid')]
if (plans) diagrams.sort((a, b) => Number(!!b.closest('article > figure')) - Number(!!a.closest('article > figure')))

if (diagrams.length) {
  // A failed load or render must not leave the body hidden; reveal the raw
  // fence text rather than a blank page.
  try {
    await draw_diagrams(diagrams, () => new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/scripts/mermaid.min.js'
      script.onload = () => resolve(window.mermaid)
      script.onerror = reject
      document.head.append(script)
    }))
    if (plans) size_diagrams(diagrams)
  } finally {
    // The body is hidden while `data-diagrams` is pending; the raw fence text
    // must never paint. Clear it once every diagram is drawn.
    document.documentElement.dataset.diagrams = 'ready'
  }
}
