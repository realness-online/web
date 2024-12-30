import Point from '@/potrace/types/Point'

const attr_regexps = {}

const get_attr_regexp = attr_name => {
  if (attr_regexps[attr_name]) {
    return attr_regexps[attr_name]
  }

  attr_regexps[attr_name] = new RegExp(
    ` ${attr_name}="((?:\\\\(?=")"|[^"])+)"`,
    'i'
  )
  return attr_regexps[attr_name]
}

export const set_html_attr = (html, attr_name, value) => {
  const attr = ` ${attr_name}="${value}"`

  if (html.indexOf(` ${attr_name}="`) === -1) {
    html = html.replace(/<[a-z]+/i, beginning => beginning + attr)
  } else {
    html = html.replace(get_attr_regexp(attr_name), attr)
  }

  return html
}

const fixed = number => number.toFixed(3).replace('.000', '')

export const mod = (a, n) =>
  a >= n ? a % n : a >= 0 ? a : n - 1 - ((-1 - a) % n)

export const xprod = (p1, p2) => p1.x * p2.y - p1.y * p2.x

export const cyclic = (a, b, c) => (a <= c ? a <= b && b < c : a <= b || b < c)

export const sign = i => (i > 0 ? 1 : i < 0 ? -1 : 0)

export const quadform = (Q, w) => {
  const v = [w.x, w.y, 1]
  let sum = 0

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      sum += v[i] * Q.at(i, j) * v[j]
    }
  }
  return sum
}

export const interval = (lambda, a, b) => {
  const res = new Point()
  res.x = a.x + lambda * (b.x - a.x)
  res.y = a.y + lambda * (b.y - a.y)
  return res
}

export const dorth_infty = (p0, p2) => {
  const r = new Point()
  r.y = sign(p2.x - p0.x)
  r.x = -sign(p2.y - p0.y)
  return r
}

export const ddenom = (p0, p2) => {
  const r = dorth_infty(p0, p2)
  return r.y * (p2.x - p0.x) - r.x * (p2.y - p0.y)
}

export const dpara = (p0, p1, p2) => {
  const x1 = p1.x - p0.x
  const y1 = p1.y - p0.y
  const x2 = p2.x - p0.x
  const y2 = p2.y - p0.y

  return x1 * y2 - x2 * y1
}

export const cprod = (p0, p1, p2, p3) => {
  const x1 = p1.x - p0.x
  const y1 = p1.y - p0.y
  const x2 = p3.x - p2.x
  const y2 = p3.y - p2.y

  return x1 * y2 - x2 * y1
}

export const iprod = (p0, p1, p2) => {
  const x1 = p1.x - p0.x
  const y1 = p1.y - p0.y
  const x2 = p2.x - p0.x
  const y2 = p2.y - p0.y

  return x1 * x2 + y1 * y2
}

export const iprod1 = (p0, p1, p2, p3) => {
  const x1 = p1.x - p0.x
  const y1 = p1.y - p0.y
  const x2 = p3.x - p2.x
  const y2 = p3.y - p2.y

  return x1 * x2 + y1 * y2
}

export const ddist = (p, q) =>
  Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y))

export const luminance = (r, g, b) =>
  Math.round(0.2126 * r + 0.7153 * g + 0.0721 * b)

export const between = (val, min, max) => val >= min && val <= max

export const clamp = (val, min, max) => Math.min(max, Math.max(min, val))

export const is_number = val => typeof val === 'number'

export const render_curve = (curve, scale = 1) => {
  const starting_point = curve.c[(curve.n - 1) * 3 + 2]
  let path = `M ${fixed(starting_point.x * scale)} ${fixed(starting_point.y * scale)} `

  curve.tag.forEach((tag, i) => {
    const i3 = i * 3
    const p0 = curve.c[i3]
    const p1 = curve.c[i3 + 1]
    const p2 = curve.c[i3 + 2]

    if (tag === 'CURVE') {
      path += `C ${fixed(p0.x * scale)} ${fixed(p0.y * scale)}, `
      path += `${fixed(p1.x * scale)} ${fixed(p1.y * scale)}, `
      path += `${fixed(p2.x * scale)} ${fixed(p2.y * scale)} `
    } else if (tag === 'CORNER') {
      path += `L ${fixed(p1.x * scale)} ${fixed(p1.y * scale)} `
      path += `${fixed(p2.x * scale)} ${fixed(p2.y * scale)} `
    }
  })

  return path
}

export const bezier = (t, p0, p1, p2, p3) => {
  const s = 1 - t
  const res = new Point()

  res.x =
    s * s * s * p0.x +
    3 * (s * s * t) * p1.x +
    3 * (t * t * s) * p2.x +
    t * t * t * p3.x
  res.y =
    s * s * s * p0.y +
    3 * (s * s * t) * p1.y +
    3 * (t * t * s) * p2.y +
    t * t * t * p3.y

  return res
}

export const tangent = (p0, p1, p2, p3, q0, q1) => {
  // ... existing implementation ...
}

export default {
  luminance,
  between,
  clamp,
  is_number,
  set_html_attr,
  render_curve,
  bezier,
  tangent,
  mod,
  xprod,
  cyclic,
  sign,
  quadform,
  interval,
  dorth_infty,
  ddenom,
  dpara,
  cprod,
  iprod,
  iprod1,
  ddist
}
