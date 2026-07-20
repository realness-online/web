import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const __d = dirname(fileURLToPath(import.meta.url))

const TILE_SHAPES = {
  ash:   'M12.52 13.85 L40.16 19.88 L67.38 9.93 L91.71 8.41 L95.14 28.54 L94.15 48.45 L92.06 64.96 L64.17 65.73 L36.23 68.61 L11.73 65.79 L10.78 47.25 L11.34 28.81 Z',
  tide:  'M94.91 11.61 L122.79 13.58 L150.37 21.59 L175.44 12.68 L178.57 29.65 L178.97 46.93 L184.65 60.77 L153.88 64.15 L123.17 69.06 L95.26 68.16 L100.55 48.45 L101.54 28.54 Z',
  silt:  'M8.53 68.99 L36.23 75.01 L64.17 72.13 L88.86 68.16 L84.50 85.72 L86.33 103.58 L89.37 118.15 L64.25 113.41 L39.93 123.57 L18.19 125.36 L18.30 105.26 L16.80 85.33 Z',
  ember: 'M92.06 71.36 L123.17 75.46 L153.88 70.55 L181.45 63.97 L186.09 84.50 L184.38 105.02 L184.60 122.34 L153.03 117.14 L121.42 112.71 L92.57 121.35 L92.73 103.58 L90.90 85.72 Z',
  rust:  'M14.99 128.56 L39.93 129.97 L64.25 119.81 L86.17 121.35 L87.65 141.12 L93.42 160.25 L98.10 176.82 L70.17 171.80 L42.10 173.61 L17.23 178.15 L13.40 160.48 L20.09 143.00 Z',
  cinder:'M89.37 124.55 L121.42 119.11 L153.03 123.54 L181.40 125.54 L178.25 143.02 L176.87 160.68 L179.36 175.20 L152.34 179.09 L125.09 171.47 L101.30 180.02 L99.82 160.25 L94.05 141.12 Z',
}

function parse(d) {
  const pts = []
  const re = /([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)/g
  let m; while ((m = re.exec(d))) pts.push({ x: +m[2], y: +m[3] })
  return pts
}

function perimeter(pts) {
  let len = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    len += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y)
  }
  return len
}

function resample(pts, n) {
  const total = perimeter(pts)
  const step = total / n
  const result = []
  let travel = 0
  let si = 0

  for (let i = 0; i < n; i++) {
    const target = i * step
    // Advance segment until target falls within it
    while (si < pts.length) {
      const ni = (si + 1) % pts.length
      const slen = Math.hypot(pts[ni].x - pts[si].x, pts[ni].y - pts[si].y)
      if (target <= travel + slen + 0.0001) break
      travel += slen
      si = ni
      if (si === 0) break
    }
    const ni = (si + 1) % pts.length
    const slen = Math.hypot(pts[ni].x - pts[si].x, pts[ni].y - pts[si].y)
    const t = slen > 0 ? Math.max(0, Math.min(1, (target - travel) / slen)) : 0
    result.push({
      x: pts[si].x + (pts[ni].x - pts[si].x) * t,
      y: pts[si].y + (pts[ni].y - pts[si].y) * t,
    })
  }
  return result
}

const N = 20
console.log('Resampling to', N, 'points each:\n')

const results = {}
for (const [name, d] of Object.entries(TILE_SHAPES)) {
  const pts = parse(d)
  const resampled = resample(pts, N)
  let out = 'M'
  for (let i = 0; i < resampled.length; i++) {
    out += `${resampled[i].x.toFixed(2)  } ${  resampled[i].y.toFixed(2)}`
    if (i < resampled.length - 1) out += ' L'
  }
  out += ' Z'
  results[name] = out
  console.log(`${name  }: ${  N  } points`)
}

let js = `// Morphable tile shapes — ${  N  } points each, same command structure\n`
js += '// Run scripts/resample-shapes.mjs to regenerate\n'
js += 'export const TILE_SHAPES = {\n'
for (const [name, d] of Object.entries(results)) 
  js += `  ${  name  }: \n    '${  d  }',\n`

js += '}\n'

await writeFile(join(__d, 'tile-shapes-morphable.js'), js)
console.log('\nWrote scripts/tile-shapes-morphable.js')
