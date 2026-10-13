import { size_diagrams } from './plan-diagrams.js'
import { draw_diagrams } from './parts.js'

const plans = document.documentElement.dataset.site === 'plans'
const diagrams = [...document.querySelectorAll('pre.mermaid')]
if (plans) diagrams.sort((a, b) => Number(!!b.closest('article > figure')) - Number(!!a.closest('article > figure')))

if (diagrams.length) {
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
    document.documentElement.dataset.diagrams = 'ready'
  }
}
