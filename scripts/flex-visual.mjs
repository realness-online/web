import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __d = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__d, '..')
const ST_DIR = join(ROOT, 'public/screentones/1974')

// ── Morphable tile shapes (resampled to 20pts, same cmd structure) ────────
const TILE_SHAPES = {
  ash:   'M12.52 13.85 L25.77 16.74 L39.03 19.63 L51.81 15.62 L64.55 10.96 L77.92 9.27 L91.46 8.43 L93.95 21.53 L94.82 34.99 L94.14 48.54 L92.44 62.00 L81.49 65.25 L67.93 65.63 L54.41 66.74 L40.92 68.13 L27.44 67.60 L13.96 66.05 L11.15 54.48 L10.97 40.93 L11.45 27.37 Z',
  tide:  'M94.91 11.61 L108.94 12.60 L122.96 13.63 L136.47 17.55 L149.97 21.47 L163.23 17.02 L175.64 13.77 L178.19 27.60 L178.85 41.63 L182.30 55.03 L176.83 61.63 L162.85 63.16 L148.91 64.95 L135.02 67.17 L121.11 68.99 L107.05 68.54 L95.85 65.97 L99.49 52.39 L101.05 38.47 L100.04 24.71 Z',
  silt:  'M8.53 68.99 L21.45 71.80 L34.38 74.61 L47.50 73.85 L60.66 72.49 L73.74 70.59 L86.80 68.49 L86.18 78.97 L85.14 91.95 L86.64 105.09 L89.35 118.03 L76.49 115.72 L63.54 113.71 L51.34 118.80 L39.07 123.64 L25.89 124.73 L18.22 119.86 L18.29 106.64 L17.41 93.44 L14.50 80.79 Z',
  ember: 'M92.06 71.36 L106.05 73.56 L120.02 75.37 L133.89 73.69 L147.74 71.20 L161.36 67.74 L175.21 64.63 L184.64 74.06 L186.01 88.45 L185.05 102.43 L184.55 116.41 L172.95 113.81 L160.27 111.71 L148.25 112.78 L136.21 114.76 L123.98 117.74 L111.78 121.15 L96.41 113.15 L92.30 100.58 L91.33 87.13 Z',
  rust:  'M14.99 128.56 L27.99 129.38 L40.99 130.12 L53.41 125.12 L65.81 120.12 L78.16 120.83 L90.52 121.58 L90.98 134.98 L92.22 148.32 L94.79 161.37 L98.10 173.79 L85.72 171.47 L73.27 169.48 L60.85 170.03 L48.43 170.87 L35.93 172.80 L23.41 175.48 L15.69 163.45 L17.67 149.19 L16.10 135.00 Z',
  cinder:'M89.37 124.55 L102.72 122.06 L116.09 119.66 L129.54 121.11 L142.97 123.90 L156.30 127.22 L169.55 128.26 L177.45 137.59 L177.47 151.59 L178.38 165.56 L178.90 179.38 L165.89 179.62 L152.88 178.86 L140.04 175.59 L127.21 172.13 L114.78 175.50 L101.30 179.32 L99.95 166.38 L97.06 153.45 L97.28 140.06 Z',
}

const TILE_NAMES = Object.keys(TILE_SHAPES)

function rng(seed) {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function pick(rand, list) { return list[Math.floor(rand() * list.length)] }

function parse_path(d) {
  const pts = []; const re = /([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)/g; let m
  while ((m = re.exec(d))) pts.push({ x: +m[2], y: +m[3] })
  return pts
}

function bbox(pts) {
  let mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity
  for (const p of pts) { if (p.x < mx) mx = p.x; if (p.y < my) my = p.y; if (p.x > Mx) Mx = p.x; if (p.y > My) My = p.y }
  return { w: Mx - mx, h: My - my, cx: (mx + Mx) / 2, cy: (my + My) / 2 }
}

const TILE_BBOX = {}
for (const name of TILE_NAMES) TILE_BBOX[name] = bbox(parse_path(TILE_SHAPES[name]))

const PALETTE = {
  light: { bg: 'oklch(0.94 0.01 100)', box: 'oklch(0.89 0.01 107)', fills: ['oklch(0.62 0.07 196)', 'oklch(0.51 0.13 21)', 'oklch(0.55 0.08 257)', 'oklch(0.35 0.01 101)'] },
  dark:  { bg: 'oklch(0.19 0.01 67)',  box: 'oklch(0.29 0.01 107)', fills: ['oklch(0.74 0.07 196)', 'oklch(0.74 0.12 20)', 'oklch(0.69 0.06 257)', 'oklch(0.35 0.01 101)'] },
}

let SCREENTONE_PATTERNS = null
async function load_screentones(scheme) {
  scheme = scheme || 'light'
  const cache_key = scheme
  if (SCREENTONE_PATTERNS && SCREENTONE_PATTERNS._s === cache_key) return SCREENTONE_PATTERNS
  if (SCREENTONE_PATTERNS) return SCREENTONE_PATTERNS
  const files = ['smalti-coarse', 'smalti-medium', 'smalti-dense', 'smalti-fine', 'smalti-grid']
  const patterns = []
  for (const name of files) 
    try {
      const c = await readFile(join(ST_DIR, `${name}.svg.html`), 'utf-8')
      const m = c.match(/<pattern[\s\S]*?<\/pattern>/)
      if (m) {
        let def = m[0].replace(/id="pattern"/, `id="st-${name}"`)
        if (scheme === 'dark') {
          def = def.replace(/fill="white"/g, 'fill="none"')
          def = def.replace(/fill="black"/g, 'fill="oklch(0.74 0.01 90)"')
        }
        patterns.push({ id: `url(#st-${name})`, def })
      }
    } catch {}
  
  patterns._s = cache_key
  SCREENTONE_PATTERNS = patterns; return patterns
}

function compose_logo(seed, scheme = 'light', use_texture = false) {
  const rand = rng(seed); const pal = PALETTE[scheme]
  const box = 192, m = 12, inner = box - m * 2
  const shuffled = [...TILE_NAMES]
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]] }
  const tiles = []
  for (let i = 0; i < shuffled.length; i++) {
    const name = shuffled[i]; const bb = TILE_BBOX[name]; const scale = 0.7 + rand() * 0.3
    const cfill = pal.fills[i % pal.fills.length]
    const rfill = pick(rand, pal.fills)
    tiles.push({ name, cx: m + bb.w * scale / 2 + rand() * (inner - bb.w * scale), cy: m + bb.h * scale / 2 + rand() * (inner - bb.h * scale), scale, deg: pick(rand, [0, 90, 180, 270]), fill: cfill, rfill, texture: use_texture && rand() < 0.4 ? pick(rand, ['st-smalti-coarse', 'st-smalti-medium', 'st-smalti-dense', 'st-smalti-fine']) : null })
  }
  return tiles
}

// For morph mode: each slot gets a different shape each state by rotating
// the tile assignment array
function compose_for_morph(seeds, scheme, use_texture = false) {
  const rand = rng(seeds[0]); const pal = PALETTE[scheme]
  const box = 192, m = 12, inner = box - m * 2
  
  // Base shuffle for seed 0
  const base = [...TILE_NAMES]
  for (let i = base.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [base[i], base[j]] = [base[j], base[i]] }
  
  const all_comps = []
  for (let si = 0; si < seeds.length; si++) {
    const srand = rng(seeds[si])
    // Rotate shapes by si positions
    const shapes = base.slice(si).concat(base.slice(0, si))
    const tiles = []
    for (let i = 0; i < shapes.length; i++) {
      const name = shapes[i]; const bb = TILE_BBOX[name]; const scale = 0.7 + srand() * 0.3
      tiles.push({ name, cx: m + bb.w * scale / 2 + srand() * (inner - bb.w * scale), cy: m + bb.h * scale / 2 + srand() * (inner - bb.h * scale), scale, deg: pick(srand, [0, 90, 180, 270]), fill: pick(srand, pal.fills), texture: use_texture && srand() < 0.8 ? pick(srand, ['st-smalti-coarse', 'st-smalti-medium', 'st-smalti-dense', 'st-smalti-fine', 'st-smalti-grid']) : null })
    }
    all_comps.push(tiles)
  }
  return all_comps
}

// Transform string for a tile (without the initial translate — that's separate for animation)
function tile_tf_part(tile) {
  const bb = TILE_BBOX[tile.name]
  return ` rotate(${  tile.deg  }) scale(${  tile.scale.toFixed(3)  }) translate(${  (-bb.cx).toFixed(1)  } ${  (-bb.cy).toFixed(1)  })`
}

function logo_svg(tiles, scheme, seed, texture_defs = '', box_size = 192) {
  const pal = PALETTE[scheme]; const size = box_size + 40; const o = 20
  let inner = ''
  for (const t of tiles) {
    const tf_part = tile_tf_part(t)
    const fill = t.texture ? `url(#${  t.texture  })` : t.fill
    inner += `<path d="${  TILE_SHAPES[t.name]  }" fill="${  fill  }" transform="translate(${  (o + t.cx).toFixed(1)  } ${  (o + t.cy).toFixed(1)  })${  tf_part  }"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${  size  } ${  size  }" role="img" aria-label="realness logo seed ${  seed  }"><title>Realness - seed ${  seed  }</title><desc>seed=${  seed  } scheme=${  scheme  }</desc><defs>${  texture_defs  }</defs><rect width="${  size  }" height="${  size  }" fill="${  pal.bg  }"/><rect x="${  o  }" y="${  o  }" width="${  box_size  }" height="${  box_size  }" fill="${  pal.box  }" rx="4"/>${  inner  }</svg>`
}

function morph_svg(seeds, scheme, texture_defs = '', hold_dur = 3, use_texture = false) {
  const pal = PALETTE[scheme]
  const comps = compose_for_morph(seeds, scheme, use_texture)
  const box = 192, size = box + 40, o = 20, n = seeds.length
  const total_dur = (hold_dur * n).toFixed(1)
  const kt = Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(2))

  let inner = ''
  for (let slot = 0; slot < 6; slot++) {
    const shapes = comps.map(c => TILE_SHAPES[c[slot].name])
    const shape_vals = shapes.join(';')
    const trans_vals = comps.map(c => `${(o + c[slot].cx).toFixed(1)  } ${  (o + c[slot].cy).toFixed(1)}`).join(';')

    // Static fill from first seed - no fill animation
    const t0 = comps[0][slot]
    const color_fill = t0.fill
    const bb = TILE_BBOX[t0.name]
    const static_tf = `rotate(${  t0.deg  }) scale(${  t0.scale.toFixed(3)  }) translate(${  (-bb.cx).toFixed(1)  } ${  (-bb.cy).toFixed(1)  })`

    if (t0.texture) 
      // Layered: solid color base + pattern overlay at reduced opacity
      inner += `<g><animateTransform attributeName="transform" type="translate" values="${  trans_vals  }" keyTimes="${  kt.join(';')  }" dur="${  total_dur  }s" repeatCount="indefinite"/>`
        + `<path d="${  shapes[0]  }" fill="${  color_fill  }" transform="${  static_tf  }"><animate attributeName="d" values="${  shape_vals  }" keyTimes="${  kt.join(';')  }" dur="${  total_dur  }s" repeatCount="indefinite"/></path>`
        + `<path d="${  shapes[0]  }" fill="url(#${  t0.texture  })" opacity="0.45" transform="${  static_tf  }"><animate attributeName="d" values="${  shape_vals  }" keyTimes="${  kt.join(';')  }" dur="${  total_dur  }s" repeatCount="indefinite"/></path></g>`
     else 
      inner += `<g><animateTransform attributeName="transform" type="translate" values="${  trans_vals  }" keyTimes="${  kt.join(';')  }" dur="${  total_dur  }s" repeatCount="indefinite"/><path d="${  shapes[0]  }" fill="${  color_fill  }" transform="${  static_tf  }"><animate attributeName="d" values="${  shape_vals  }" keyTimes="${  kt.join(';')  }" dur="${  total_dur  }s" repeatCount="indefinite"/></path></g>`
    
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${  size  } ${  size  }" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img"><style>svg{background:${  pal.bg  }}</style><title>Realness morph - ${  seeds.join(',')  }</title><desc>morph seeds=${  seeds.join(',')  } scheme=${  scheme  }</desc><defs>${  texture_defs  }</defs><rect width="${  size  }" height="${  size  }" fill="${  pal.bg  }"/><rect x="${  o  }" y="${  o  }" width="${  box  }" height="${  box  }" fill="${  pal.box  }" rx="4"/>${  inner  }</svg>`
}

function html_contact(seeds, scheme, texture_defs = '') {
  const pal = PALETTE[scheme]
  const tc = scheme === 'dark' ? '#e6e2da' : '#1a1a1e'
  let items = ''
  for (const s of seeds) {
    const tiles = compose_logo(s, scheme)
    const svg = logo_svg(tiles, scheme, s, texture_defs)
    items += `<div class="item"><div class="svg-wrap">${  svg  }</div><span class="label">${  scheme  } seed ${  s  }</span></div>`
  }
  return items
}

function html_both(seeds, texture_defs = '') {
  const items = html_contact(seeds, 'light', texture_defs) + html_contact(seeds, 'dark', texture_defs)
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Realness - logos</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Lato,sans-serif;background:#1a1a1e;color:#e6e2da;padding:2rem}h1{font-size:1.5rem;font-weight:300;margin-bottom:.5rem}.meta{font-size:.85rem;opacity:.7;margin-bottom:2rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.5rem}.item{text-align:center}.svg-wrap{width:100%;aspect-ratio:1}.svg-wrap svg{width:100%;height:100%;display:block}.label{font-size:.8rem;margin-top:.4rem;display:block;opacity:.8}</style></head><body><h1>Realness - logo system</h1><p class="meta">${  seeds.length  } seeds &times; light + dark</p><div class="grid">${  items  }</div></body></html>`
}

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flags = {}
for (let i = 0; i < args.length; i++) 
  if (args[i].startsWith('--')) {
    const k = args[i].slice(2)
    const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true
    flags[k] = v; if (v !== true) i++
  }


const scheme = flags.scheme || 'light'
const outdir = flags.out || 'public/generative'

async function main() {
  await mkdir(outdir, { recursive: true })
  let tdefs = ''
  if (flags.texture) { const p = await load_screentones(scheme); tdefs = p.map(x => x.def).join('\n') }

  if (flags.morph) {
    const seeds = flags.morph.split(',').map(Number)
    const svg = morph_svg(seeds, scheme, tdefs, parseFloat(flags.dur) || 3, !!flags.texture)
    const fn = `${outdir  }/realness-morph-${  seeds.join('-')  }-${  scheme  }.svg`
    await writeFile(fn, svg)
    console.log(`Wrote ${  fn}`)
    return
  }

  const n = parseInt(flags.sweep, 10) || 12
  const seeds = Array.from({ length: n }, (_, i) => i + 1)

  if (flags.both) {
    const html = html_both(seeds, tdefs)
    const fn = `${outdir  }/realness-logos-both.html`
    await writeFile(fn, html)
    console.log(`Wrote ${  fn}`)
    // Also write individual SVGs for both schemes
    for (const s of seeds) {
      await writeFile(`${outdir  }/realness-logo-light-s${  s  }.svg`, logo_svg(compose_logo(s, 'light'), 'light', s, tdefs))
      await writeFile(`${outdir  }/realness-logo-dark-s${  s  }.svg`, logo_svg(compose_logo(s, 'dark'), 'dark', s, tdefs))
    }
    console.log(`Wrote ${  seeds.length * 2  } individual SVGs`)
    return
  }

  // Single scheme
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Realness - logos</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Lato,sans-serif;background:${  PALETTE[scheme].bg  };color:${  scheme === 'dark' ? '#e6e2da' : '#1a1a1e'  };padding:2rem}h1{font-size:1.5rem;font-weight:300;margin-bottom:.5rem}.meta{font-size:.85rem;opacity:.7;margin-bottom:2rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.5rem}.item{text-align:center}.svg-wrap{width:100%;aspect-ratio:1}.svg-wrap svg{width:100%;height:100%;display:block}.label{font-size:.8rem;margin-top:.4rem;display:block;opacity:.8}</style></head><body><h1>Realness - logos</h1><p class="meta">scheme: ${  scheme  } | ${  seeds.length  } variations</p><div class="grid">${  html_contact(seeds, scheme, tdefs)  }</div></body></html>`
  const fn = `${outdir  }/realness-logos-${  scheme  }.html`
  await writeFile(fn, html)
  console.log(`Wrote ${  fn}`)
  for (const s of seeds) 
    await writeFile(`${outdir  }/realness-logo-${  scheme  }-s${  s  }.svg`, logo_svg(compose_logo(s, scheme), scheme, s, tdefs))
  
  console.log(`Wrote ${  seeds.length  } individual SVGs`)
}

main().catch(console.error)
