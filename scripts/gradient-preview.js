#!/usr/bin/env node
/**
 * Look at what the gradient sampling changed.
 *
 * Renders the three gradients a picture produces, once the way the worker
 * sampled them before and once the way it samples them now, so the fixes are
 * something you can see rather than a number in a test.
 *
 * Usage: node scripts/gradient-preview.js <image> [out.html]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { createCanvas, loadImage } from 'canvas'

const RGBA = 4
const FIDELITY = 15
const PERCENT = 100
const CHANNEL_MAX = 255
const HUE_SEGMENTS = 6
const DEGREES_PER_SEGMENT = 60
const FULL_CIRCLE = 360
const GREEN_SEGMENT = 2
const BLUE_SEGMENT = 4
const HALF = 0.5

const to_hsl = ({ r, g, b }) => {
  const red = r / CHANNEL_MAX
  const green = g / CHANNEL_MAX
  const blue = b / CHANNEL_MAX
  const cmin = Math.min(red, green, blue)
  const cmax = Math.max(red, green, blue)
  const delta = cmax - cmin
  let h = 0
  if (delta !== 0)
    if (cmax === red) h = ((green - blue) / delta) % HUE_SEGMENTS
    else if (cmax === green) h = (blue - red) / delta + GREEN_SEGMENT
    else h = (red - green) / delta + BLUE_SEGMENT

  h = Math.round(h * DEGREES_PER_SEGMENT)
  if (h < 0) h += FULL_CIRCLE
  const l = (cmax + cmin) * HALF
  // 2l is cmax + cmin, so the usual saturation formula needs no doubling
  const s = delta === 0 ? 0 : Math.abs(delta / (1 - Math.abs(cmax + cmin - 1)))
  return {
    h,
    s: Math.round(s * PERCENT),
    l: Math.round(l * PERCENT)
  }
}

const as_css = ({ h, s, l }) => `hsl(${h}, ${s}%, ${l}%)`

/**
 * What as-stops.vue does to a sampled stop: keep the hue, keep the saturation
 * unless a floor lifts it, and swap in the layer's luminosity.
 */
const relight = (color, luminosity, floor) => ({
  h: color.h,
  s: floor && color.s < floor ? floor : color.s,
  l: luminosity
})

/** The old read: plain mean of sRGB bytes, alpha summed in as colour. */
const average_before = (image, { x, y, width, height }) => {
  let r = 0,
    g = 0,
    b = 0
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const w = Math.floor(width)
  const h = Math.floor(height)
  const count = w * h
  for (let row = y0; row < y0 + h; row++)
    for (let column = x0; column < x0 + w; column++) {
      // Past the edge reads as transparent black, exactly as a canvas pads it
      const outside =
        row < 0 || row >= image.height || column < 0 || column >= image.width
      if (outside) continue
      const i = (row * image.width + column) * RGBA
      r += image.data[i]
      g += image.data[i + 1]
      b += image.data[i + 2]
    }

  return { r: r / count, g: g / count, b: b / count }
}

/** The read the worker does now: linear light, weighted by alpha. */
const average_after = (image, { x, y, width, height }) => {
  let r = 0,
    g = 0,
    b = 0,
    weight = 0
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  for (let row = y0; row < y0 + h; row++)
    for (let column = x0; column < x0 + w; column++) {
      const i = (row * image.width + column) * RGBA
      const alpha = image.data[i + 3]
      r += image.data[i] * image.data[i] * alpha
      g += image.data[i + 1] * image.data[i + 1] * alpha
      b += image.data[i + 2] * image.data[i + 2] * alpha
      weight += alpha
    }

  if (!weight) return { r: 0, g: 0, b: 0 }
  return {
    r: Math.sqrt(r / weight),
    g: Math.sqrt(g / weight),
    b: Math.sqrt(b / weight)
  }
}

/** How far along the axis a strip of this kind walks. */
const axis_length = (image, axis) => {
  if (axis === 'vertical') return image.height
  if (axis === 'radial') return Math.min(image.width, image.height)
  return image.width
}

/** The rectangle a strip covers, in the axis it belongs to. */
const strip_region = (image, axis, at, reach) => {
  const box = Math.min(image.width, image.height)
  if (axis === 'vertical')
    return { x: 0, y: at, width: image.width, height: reach }
  if (axis === 'radial') return { x: at, y: 0, width: reach, height: box }
  return { x: at, y: 0, width: reach, height: image.height }
}

const strips = (image, axis, era) => {
  const direction = axis_length(image, axis)
  const chunk = direction * (FIDELITY / PERCENT)
  const after = era === 'after'
  const stops = []

  for (let i = 0; i < direction; i += chunk) {
    const reach = after ? Math.min(chunk, direction - i) : chunk
    const region = strip_region(image, axis, i, reach)
    const color = after
      ? average_after(image, region)
      : average_before(image, region)
    const at = after ? i + reach * HALF : i
    stops.push({ color: to_hsl(color), offset: (at / direction) * PERCENT })
  }

  if (after && stops.length > 1) {
    stops[0].offset = 0
    stops[stops.length - 1].offset = PERCENT
  }
  return stops
}

const as_bar = (stops, id) => {
  const marks = stops
    .map(
      stop =>
        `<stop offset="${stop.offset.toFixed(1)}%" stop-color="${as_css(stop.color)}"/>`
    )
    .join('')
  const ticks = stops
    .map(
      stop =>
        `<line x1="${stop.offset}%" x2="${stop.offset}%" y1="0" y2="10" stroke="black" stroke-opacity="0.35"/>`
    )
    .join('')
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" x2="1">${marks}</linearGradient></defs>
    <rect width="100" height="40" fill="url(#${id})"/>
    <g transform="scale(1,4)">${ticks}</g>
  </svg>`
}

/** Inlined so the page can be opened, moved, or shared on its own. */
const as_data_uri = path => {
  const kind = path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
  return `data:image/${kind};base64,${readFileSync(resolve(path)).toString('base64')}`
}

const [, , source, destination] = process.argv
if (!source) {
  console.error('usage: node scripts/gradient-preview.js <image> [out.html]')
  process.exit(1)
}

const picture = await loadImage(resolve(source))
const canvas = createCanvas(picture.width, picture.height)
canvas.getContext('2d').drawImage(picture, 0, 0)
const image = canvas
  .getContext('2d')
  .getImageData(0, 0, picture.width, picture.height)

const rows = ['horizontal', 'vertical', 'radial']
  .map(axis => {
    const before = as_bar(strips(image, axis, 'before'), `${axis}-before`)
    const after = as_bar(strips(image, axis, 'after'), `${axis}-after`)
    return `<section>
      <h2>${axis}</h2>
      <figure><figcaption>before</figcaption>${before}</figure>
      <figure><figcaption>after</figcaption>${after}</figure>
    </section>`
  })
  .join('')

// The four places as-gradients.vue lifts a stop's saturation, and the layer
// luminosity each one is re-lit to
const FLOORED = [
  { name: 'radial-background', axis: 'radial', luminosity: 81, floor: 13 },
  { name: 'vertical-light', axis: 'vertical', luminosity: 60, floor: 21 },
  { name: 'horizontal-regular', axis: 'horizontal', luminosity: 44, floor: 18 },
  { name: 'horizontal-medium', axis: 'horizontal', luminosity: 20, floor: 18 }
]

const floors = FLOORED.map(layer => {
  const sampled = strips(image, layer.axis, 'after')
  const as_layer = floor =>
    sampled.map(stop => ({
      offset: stop.offset,
      color: relight(stop.color, layer.luminosity, floor)
    }))
  const lifted = sampled.filter(stop => stop.color.s < layer.floor).length
  return `<section>
    <h2>${layer.name}</h2>
    <figure><figcaption>floor of ${layer.floor}</figcaption>${as_bar(as_layer(layer.floor), `${layer.name}-floor`)}</figure>
    <figure><figcaption>no floor</figcaption>${as_bar(as_layer(0), `${layer.name}-bare`)}</figure>
    <p>${lifted} of ${sampled.length} stops sit under the floor.</p>
  </section>`
}).join('')

const out = destination || 'gradient-preview.html'
writeFileSync(
  resolve(out),
  `<!doctype html><meta charset="utf-8"><title>gradient preview</title>
<style>
  body { font: 16px system-ui; margin: 2rem; max-width: 60rem }
  svg { width: 100%; height: 3rem; display: block }
  figcaption { font-size: 0.8rem; opacity: 0.6 }
  figure { margin: 0 0 0.75rem }
  section { margin-bottom: 2rem }
  img { max-width: 20rem }
</style>
<h1>${basename(source)}</h1>
<img src="${as_data_uri(source)}" alt="the source picture">
<h2>Sampling, before and after</h2>
${rows}
<h2>Shadow layers, with the saturation floor and without</h2>
${floors}
`
)
console.info(`wrote ${out}`)
