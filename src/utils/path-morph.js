/**
 * Canonical path geometry for morphing.
 *
 * SVG only interpolates `d` when both sides carry the same commands, of the
 * same type, in the same order. Poster layers never do - potrace picks its
 * contours per threshold, and svgo then rewrites archived posters into
 * relative commands and arcs. Normalizing a set of layers against each other
 * rebuilds them all as `M` + a fixed run of `C` + `Z`, repeated a fixed number
 * of times, so any two of them morph natively.
 */

/** @typedef {[number, number]} Point */
/** @typedef {number[]} Cubic Six numbers: two control points then the end point */
/** @typedef {{ start: Point, cubics: Cubic[] }} Contour */
/** @typedef {{ points: Point[], lengths: number[], total: number }} Polyline */

const NUMBER = /[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g
const COMMAND = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g

const THIRD = 1 / 3
const TWO_THIRDS = 2 / 3
const TWO = 2
const HALF = 1 / 2
/** The 3 in a cubic's Bernstein terms */
const MATRIX_DIMENSION = 3
const DEGREES_PER_HALF_TURN = 180
const QUARTER_TURN = Math.PI / 2
const FULL_TURN = 2 * Math.PI
/**
 * Control-point distance for a cubic approximating a circular arc:
 * `(4/3) * tan(sweep / 4)` of the radius.
 */
const ARC_HANDLE_DIVISOR = 4
const ARC_HANDLE = ARC_HANDLE_DIVISOR * THIRD

/** How many numbers each path command consumes per repeat */
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }

/**
 * A cubic through four evenly parameterized points: each control point is the
 * dot product of those points with a row, over the divisor.
 */
const FIT_DIVISOR = 6
const FIT_NEAR = -5
const FIT_PULL = 18
const FIT_PUSH = -9
const FIT_FAR = 2
const FIT_FIRST_CONTROL = [FIT_NEAR, FIT_PULL, FIT_PUSH, FIT_FAR]
// The mirror of the first row, because the fit is symmetric end to end
const FIT_SECOND_CONTROL = [...FIT_FIRST_CONTROL].reverse()

/**
 * @param {number[]} row
 * @param {Point[]} points
 * @param {number} axis 0 for x, 1 for y
 * @returns {number}
 */
const fit = (row, points, axis) =>
  row.reduce((total, weight, i) => total + weight * points[i][axis], 0) /
  FIT_DIVISOR

/** Straight-line samples taken per cubic when measuring arc length */
const SAMPLES_PER_CUBIC = 12
/** Start-vertex offsets tried when aligning a contour to its reference */
const PHASE_ATTEMPTS = 32
/** Decimal places in a keyTimes fraction */
const KEY_TIME_PRECISION = 4
/** Base for the rounding factor */
const DECIMAL_BASE = 10

/**
 * A safety limit, not a quality dial. Ranking contours by area and keeping the
 * biggest sounds harmless, but a layer can paint a whole region with many
 * small marks - drop those and the layer morphs into a fraction of itself.
 * Set high enough that real posters keep everything they traced.
 */
export const DEFAULT_CONTOURS = 128
/** Ceiling for the per-contour segment count */
export const DEFAULT_SEGMENTS = 36
const MIN_SEGMENTS = 12
/**
 * Cubics a layer may spend. Keyframes carry whole path strings, so payload
 * follows contours x segments - a busy poster buys its extra shapes by
 * describing each one more coarsely, rather than by losing some of them.
 */
const CURVE_BUDGET = 1600
export const DEFAULT_PRECISION = 1

/**
 * @param {number} count How many contours the set has to carry
 * @returns {number}
 */
export const segments_for = count =>
  Math.min(
    DEFAULT_SEGMENTS,
    Math.max(MIN_SEGMENTS, Math.round(CURVE_BUDGET / Math.max(1, count)))
  )

/**
 * Cubics per slot, weighted by how much perimeter that slot actually carries.
 * An even split per contour starves a large, branching shape of the curves it
 * needs while wasting them on simple ones the same rank - which is what
 * turned a detailed contour into a blob. Every layer sharing a slot morphs
 * through the same cubic count, so the slot answers to whichever occupant -
 * not just the reference layer's - is the most complex.
 * @param {(Measured | null)[][]} filled One slot array per layer
 * @param {number} count
 * @returns {number[]}
 */
const segments_for_slots = (filled, count) => {
  const lengths = Array.from({ length: count }, (unused, slot) =>
    Math.max(0, ...filled.map(layer => layer[slot]?.polyline.total ?? 0))
  )
  const total_length = lengths.reduce((sum, length) => sum + length, 0) || 1
  // Every slot is guaranteed the usual floor; what is left of the budget
  // after that goes to whichever slots actually carry the perimeter to use
  // it, rather than sitting unspent on shapes too simple to need it.
  const bonus_budget = Math.max(0, CURVE_BUDGET - count * MIN_SEGMENTS)
  return lengths.map(
    length => MIN_SEGMENTS + Math.round((length / total_length) * bonus_budget)
  )
}

/**
 * A cubic is six numbers - two control points then the end point. Reading
 * them by name keeps the geometry legible.
 * @param {Cubic} cubic
 * @returns {{ first: Point, second: Point, end: Point }}
 */
const parts_of = ([cx1, cy1, cx2, cy2, x, y]) => ({
  first: [cx1, cy1],
  second: [cx2, cy2],
  end: [x, y]
})

/**
 * @param {Cubic} cubic
 * @returns {Point}
 */
const end_of = cubic => parts_of(cubic).end

/**
 * Chop a command's parameter list into one run per repeat.
 * @param {number[]} params
 * @param {number} arity
 * @returns {number[][]}
 */
const as_runs = (params, arity) => {
  if (!arity) return []
  const runs = []
  for (let i = 0; i + arity <= params.length; i += arity)
    runs.push(params.slice(i, i + arity))
  return runs
}

/**
 * Reflect the previous control point through the current point, which is what
 * the smooth commands `S` and `T` mean by "continue".
 * @param {Point | null} control
 * @param {Point} through
 * @returns {Point}
 */
const mirrored = (control, through) => {
  if (!control) return through
  const [px, py] = through
  return [TWO * px - control[0], TWO * py - control[1]]
}

/**
 * @param {string} d
 * @returns {{ command: string, params: number[] }[]}
 */
const as_tokens = d => {
  const tokens = []
  let match
  COMMAND.lastIndex = 0
  while ((match = COMMAND.exec(d)) !== null)
    tokens.push({
      command: match[1],
      params: (match[2].match(NUMBER) || []).map(Number)
    })
  return tokens
}

/**
 * Endpoint-parameterized arc to a run of cubics. Archived posters carry `A`
 * because svgo's `makeArcs` puts it there.
 * @param {Object} arc
 * @param {Point} arc.from
 * @param {Point} arc.to
 * @param {number} arc.rx
 * @param {number} arc.ry
 * @param {number} arc.degrees
 * @param {boolean} arc.large
 * @param {boolean} arc.sweep
 * @returns {Cubic[]}
 */
const arc_as_cubics = ({ from, to, rx, ry, degrees, large, sweep }) => {
  const [x0, y0] = from
  const [x, y] = to
  if (rx === 0 || ry === 0) return [[x0, y0, x, y, x, y]]

  const radians = (degrees * Math.PI) / DEGREES_PER_HALF_TURN
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = (x0 - x) * HALF
  const dy = (y0 - y) * HALF
  const x1 = cos * dx + sin * dy
  const y1 = -sin * dx + cos * dy

  // An arc whose radii cannot span the two endpoints gets scaled up until it
  // can, which is what the spec asks for
  const span = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  const stretch = span > 1 ? Math.sqrt(span) : 1
  const radius_x = rx * stretch
  const radius_y = ry * stretch
  const rx2 = radius_x * radius_x
  const ry2 = radius_y * radius_y

  const sign = large === sweep ? -1 : 1
  const numerator = rx2 * ry2 - rx2 * y1 * y1 - ry2 * x1 * x1
  const denominator = rx2 * y1 * y1 + ry2 * x1 * x1
  const ratio = sign * Math.sqrt(Math.max(0, numerator / denominator))
  const cx1 = (ratio * radius_x * y1) / radius_y
  const cy1 = (-ratio * radius_y * x1) / radius_x
  const cx = cos * cx1 - sin * cy1 + (x0 + x) * HALF
  const cy = sin * cx1 + cos * cy1 + (y0 + y) * HALF

  const angle_between = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy
    const length = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    const angle = Math.acos(Math.min(1, Math.max(-1, dot / length)))
    if (ux * vy - uy * vx < 0) return -angle
    return angle
  }

  const start_angle = angle_between(
    1,
    0,
    (x1 - cx1) / radius_x,
    (y1 - cy1) / radius_y
  )
  let sweep_angle = angle_between(
    (x1 - cx1) / radius_x,
    (y1 - cy1) / radius_y,
    (-x1 - cx1) / radius_x,
    (-y1 - cy1) / radius_y
  )
  if (!sweep && sweep_angle > 0) sweep_angle -= FULL_TURN
  if (sweep && sweep_angle < 0) sweep_angle += FULL_TURN

  const count = Math.ceil(Math.abs(sweep_angle / QUARTER_TURN))
  const step = sweep_angle / count
  const handle = ARC_HANDLE * Math.tan(step / ARC_HANDLE_DIVISOR)

  const at = angle => [
    cos * radius_x * Math.cos(angle) - sin * radius_y * Math.sin(angle) + cx,
    sin * radius_x * Math.cos(angle) + cos * radius_y * Math.sin(angle) + cy
  ]
  const slope_at = angle => [
    -cos * radius_x * Math.sin(angle) - sin * radius_y * Math.cos(angle),
    -sin * radius_x * Math.sin(angle) + cos * radius_y * Math.cos(angle)
  ]

  const cubics = []
  let angle = start_angle
  let [px, py] = [x0, y0]
  for (let i = 0; i < count; i++) {
    const next = angle + step
    const [ex, ey] = at(next)
    const [sx1, sy1] = slope_at(angle)
    const [sx2, sy2] = slope_at(next)
    cubics.push([
      px + handle * sx1,
      py + handle * sy1,
      ex - handle * sx2,
      ey - handle * sy2,
      ex,
      ey
    ])
    px = ex
    py = ey
    angle = next
  }
  return cubics
}

/**
 * @typedef {Object} Pen
 * @property {Contour[]} contours
 * @property {Contour | null} current
 * @property {number} x
 * @property {number} y
 * @property {number} start_x
 * @property {number} start_y
 * @property {Point | null} cubic_control Previous cubic's second control, for `S`
 * @property {Point | null} quadratic_control Previous quadratic's control, for `T`
 */

/** @returns {Pen} */
const create_pen = () => ({
  contours: [],
  current: null,
  x: 0,
  y: 0,
  start_x: 0,
  start_y: 0,
  cubic_control: null,
  quadratic_control: null
})

/**
 * @param {Pen} pen
 * @param {Cubic} cubic
 */
const draw = (pen, cubic) => {
  if (!pen.current) return
  pen.current.cubics.push(cubic)
  ;[pen.x, pen.y] = end_of(cubic)
}

/** @param {Pen} pen */
const line_to = (pen, to_x, to_y) => {
  const { x, y } = pen
  draw(pen, [
    x + (to_x - x) * THIRD,
    y + (to_y - y) * THIRD,
    x + (to_x - x) * TWO_THIRDS,
    y + (to_y - y) * TWO_THIRDS,
    to_x,
    to_y
  ])
  pen.cubic_control = null
  pen.quadratic_control = null
}

/** @param {Pen} pen */
const quadratic_to = (pen, control_x, control_y, to_x, to_y) => {
  const { x, y } = pen
  draw(pen, [
    x + (control_x - x) * TWO_THIRDS,
    y + (control_y - y) * TWO_THIRDS,
    to_x + (control_x - to_x) * TWO_THIRDS,
    to_y + (control_y - to_y) * TWO_THIRDS,
    to_x,
    to_y
  ])
  pen.quadratic_control = [control_x, control_y]
  pen.cubic_control = null
}

/** @param {Pen} pen */
const move_to = (pen, to_x, to_y) => {
  pen.current = { start: [to_x, to_y], cubics: [] }
  pen.contours.push(pen.current)
  pen.start_x = to_x
  pen.start_y = to_y
  pen.x = to_x
  pen.y = to_y
  pen.cubic_control = null
  pen.quadratic_control = null
}

/**
 * The commands that only ever move the pen in straight lines.
 * @param {Pen} pen
 * @param {string} absolute
 * @param {boolean} relative
 * @param {number[][]} runs
 */
const apply_straight_command = (pen, absolute, relative, runs) => {
  if (absolute === 'M')
    for (const [index, [to_x, to_y]] of runs.entries()) {
      const at_x = relative ? pen.x + to_x : to_x
      const at_y = relative ? pen.y + to_y : to_y
      // Only the first pair moves; the rest are an implicit lineto run
      if (index === 0) move_to(pen, at_x, at_y)
      else line_to(pen, at_x, at_y)
    }
  else if (absolute === 'L')
    for (const [to_x, to_y] of runs)
      line_to(
        pen,
        relative ? pen.x + to_x : to_x,
        relative ? pen.y + to_y : to_y
      )
  else if (absolute === 'H')
    for (const [to_x] of runs)
      line_to(pen, relative ? pen.x + to_x : to_x, pen.y)
  else if (absolute === 'V')
    for (const [to_y] of runs)
      line_to(pen, pen.x, relative ? pen.y + to_y : to_y)
  else if (absolute === 'Z') {
    const { start_x, start_y } = pen
    if (pen.x !== start_x || pen.y !== start_y) line_to(pen, start_x, start_y)
    pen.x = start_x
    pen.y = start_y
  }
}

/**
 * The curve commands, including the smooth continuations and arcs svgo leaves
 * on archived posters.
 * @param {Pen} pen
 * @param {string} absolute
 * @param {boolean} relative
 * @param {number[][]} runs
 */
const apply_curve_command = (pen, absolute, relative, runs) => {
  const base = () => (relative ? [pen.x, pen.y] : [0, 0])

  if (absolute === 'C')
    for (const [c1x, c1y, c2x, c2y, to_x, to_y] of runs) {
      const [base_x, base_y] = base()
      /** @type {Point} */
      const control = [base_x + c2x, base_y + c2y]
      draw(pen, [
        base_x + c1x,
        base_y + c1y,
        control[0],
        control[1],
        base_x + to_x,
        base_y + to_y
      ])
      pen.cubic_control = control
      pen.quadratic_control = null
    }
  else if (absolute === 'S')
    for (const [c2x, c2y, to_x, to_y] of runs) {
      const [base_x, base_y] = base()
      /** @type {Point} */
      const control = [base_x + c2x, base_y + c2y]
      const [mirror_x, mirror_y] = mirrored(pen.cubic_control, [pen.x, pen.y])
      draw(pen, [
        mirror_x,
        mirror_y,
        control[0],
        control[1],
        base_x + to_x,
        base_y + to_y
      ])
      pen.cubic_control = control
      pen.quadratic_control = null
    }
  else if (absolute === 'Q')
    for (const [cx, cy, to_x, to_y] of runs) {
      const [base_x, base_y] = base()
      quadratic_to(pen, base_x + cx, base_y + cy, base_x + to_x, base_y + to_y)
    }
  else if (absolute === 'T')
    for (const [to_x, to_y] of runs) {
      const [mirror_x, mirror_y] = mirrored(pen.quadratic_control, [
        pen.x,
        pen.y
      ])
      quadratic_to(
        pen,
        mirror_x,
        mirror_y,
        relative ? pen.x + to_x : to_x,
        relative ? pen.y + to_y : to_y
      )
    }
  else if (absolute === 'A')
    for (const [rx, ry, degrees, large, sweep, to_x, to_y] of runs)
      for (const cubic of arc_as_cubics({
        from: [pen.x, pen.y],
        to: [relative ? pen.x + to_x : to_x, relative ? pen.y + to_y : to_y],
        rx: Math.abs(rx),
        ry: Math.abs(ry),
        degrees,
        large: Boolean(large),
        sweep: Boolean(sweep)
      }))
        draw(pen, cubic)
}

const STRAIGHT_COMMANDS = new Set(['M', 'L', 'H', 'V', 'Z'])

/**
 * Parse path data into closed contours of absolute cubics.
 *
 * Handles the whole command vocabulary because poster data arrives in two
 * shapes: raw potrace (`M C L`) for a fresh trace, and svgo output (relative
 * commands, arcs, quadratics) for anything already in storage.
 *
 * @param {string} d
 * @returns {Contour[]}
 */
export const as_contours = d => {
  const pen = create_pen()

  for (const { command, params } of as_tokens(d)) {
    const relative = command === command.toLowerCase()
    const absolute = command.toUpperCase()
    // Nothing to draw on before the first moveto
    if (absolute !== 'M' && !pen.current) continue

    // Each command repeats until its parameters run out, so walk them one
    // arity at a time and read each run by name
    const runs = as_runs(params, ARITY[absolute])
    if (STRAIGHT_COMMANDS.has(absolute))
      apply_straight_command(pen, absolute, relative, runs)
    else apply_curve_command(pen, absolute, relative, runs)
  }

  const { contours } = pen

  // Potrace closes its contours by returning to the start point rather than
  // emitting `Z`, so close anything still open before we measure it.
  for (const contour of contours) {
    const last = contour.cubics.at(-1)
    if (!last) continue
    const [end_x, end_y] = end_of(last)
    const [first_x, first_y] = contour.start
    if (end_x === first_x && end_y === first_y) continue
    contour.cubics.push([
      end_x + (first_x - end_x) * THIRD,
      end_y + (first_y - end_y) * THIRD,
      end_x + (first_x - end_x) * TWO_THIRDS,
      end_y + (first_y - end_y) * TWO_THIRDS,
      first_x,
      first_y
    ])
  }

  return contours.filter(contour => contour.cubics.length > 0)
}

/**
 * @param {Point} from
 * @param {Cubic} cubic
 * @param {number} t
 * @returns {Point}
 */
const point_on_cubic = (from, cubic, t) => {
  const { first, second, end } = parts_of(cubic)
  const s = 1 - t
  const a = s * s * s
  const b = MATRIX_DIMENSION * s * s * t
  const c = MATRIX_DIMENSION * s * t * t
  const d = t * t * t
  return [
    a * from[0] + b * first[0] + c * second[0] + d * end[0],
    a * from[1] + b * first[1] + c * second[1] + d * end[1]
  ]
}

/**
 * Flatten a contour to a polyline carrying cumulative arc length, which is
 * what lets us resample by distance rather than by segment index.
 * @param {Contour} contour
 * @returns {Polyline}
 */
const as_polyline = contour => {
  const points = [contour.start]
  let from = contour.start
  for (const cubic of contour.cubics) {
    for (let i = 1; i <= SAMPLES_PER_CUBIC; i++)
      points.push(point_on_cubic(from, cubic, i / SAMPLES_PER_CUBIC))
    from = end_of(cubic)
  }

  const lengths = [0]
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1]
    )
    lengths.push(total)
  }

  return { points, lengths, total }
}

/**
 * Point at an arc-length offset around a closed polyline. Offsets wrap, which
 * is how the start-vertex rotation works.
 * @param {Polyline} polyline
 * @param {number} distance
 * @returns {Point}
 */
const at_length = (polyline, distance) => {
  const { points, lengths, total } = polyline
  if (total === 0) return points[0]

  let target = distance % total
  if (target < 0) target += total

  let low = 0
  let high = lengths.length - 1
  while (low < high - 1) {
    const middle = Math.floor((low + high) / 2)
    if (lengths[middle] <= target) low = middle
    else high = middle
  }

  const span = lengths[high] - lengths[low]
  const fraction = span === 0 ? 0 : (target - lengths[low]) / span
  return [
    points[low][0] + (points[high][0] - points[low][0]) * fraction,
    points[low][1] + (points[high][1] - points[low][1]) * fraction
  ]
}

/**
 * Shoelace area. The sign carries winding direction, which we need because two
 * contours wound opposite each other turn inside out mid-morph.
 * @param {Polyline} polyline
 * @returns {number}
 */
const signed_area = polyline => {
  const { points } = polyline
  let total = 0
  for (let i = 0; i < points.length - 1; i++)
    total += points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1]
  return total / 2
}

/**
 * @param {Polyline} polyline
 * @returns {Point}
 */
const middle_of = polyline => {
  const { points } = polyline
  let x = 0
  let y = 0
  for (const point of points) {
    x += point[0]
    y += point[1]
  }
  return [x / points.length, y / points.length]
}

/**
 * Rebuild a contour as exactly `segments` cubics, starting `phase` along it.
 *
 * Each cubic is fitted through four points sampled off the original curve, so
 * the shape survives the trip rather than being chorded flat.
 *
 * @param {Polyline} polyline
 * @param {number} segments
 * @param {number} phase Arc-length offset of the new start vertex
 * @param {boolean} reverse Walk the contour the other way round
 * @returns {Contour}
 */
const resample = (polyline, segments, phase, reverse) => {
  const direction = reverse ? -1 : 1
  const step = polyline.total / segments
  const sample = index => at_length(polyline, phase + direction * index * step)

  const cubics = []
  for (let i = 0; i < segments; i++) {
    const p0 = sample(i)
    const p1 = sample(i + THIRD)
    const p2 = sample(i + TWO_THIRDS)
    const p3 = sample(i + 1)
    // Cubic through four evenly parameterized points
    cubics.push([
      fit(FIT_FIRST_CONTROL, [p0, p1, p2, p3], 0),
      fit(FIT_FIRST_CONTROL, [p0, p1, p2, p3], 1),
      fit(FIT_SECOND_CONTROL, [p0, p1, p2, p3], 0),
      fit(FIT_SECOND_CONTROL, [p0, p1, p2, p3], 1),
      p3[0],
      p3[1]
    ])
  }

  return { start: sample(0), cubics }
}

/**
 * A contour collapsed onto a point. A layer with nothing at this slot grows
 * out of - and shrinks back into - the place the other layers put that shape.
 * @param {Point} point
 * @param {number} segments
 * @returns {Contour}
 */
const as_point_contour = ([x, y], segments) => ({
  start: [x, y],
  cubics: Array.from({ length: segments }, () => [x, y, x, y, x, y])
})

const round_to = (value, precision) => {
  const factor = DECIMAL_BASE ** precision
  return Math.round(value * factor) / factor
}

/**
 * @param {Contour[]} contours
 * @param {number} precision
 * @returns {string}
 */
const as_path_data = (contours, precision) =>
  contours
    .map(contour => {
      const at = value => round_to(value, precision)
      let d = `M${at(contour.start[0])} ${at(contour.start[1])}`
      for (const cubic of contour.cubics) d += `C${cubic.map(at).join(' ')}`
      return `${d}Z`
    })
    .join('')

/**
 * @typedef {Object} Measured
 * @property {Polyline} polyline
 * @property {number} area
 * @property {boolean} clockwise
 * @property {Point} middle
 * @property {boolean} [padding] Slot filled by a point contour, not a real shape
 */

/**
 * @param {string} d
 * @param {number} limit
 * @returns {Measured[]}
 */
const as_measured_contours = (d, limit) =>
  as_contours(d)
    .map(contour => {
      const polyline = as_polyline(contour)
      const area = signed_area(polyline)
      return {
        polyline,
        area: Math.abs(area),
        clockwise: area > 0,
        middle: middle_of(polyline)
      }
    })
    .filter(measured => measured.polyline.total > 0)
    .sort((first, second) => second.area - first.area)
    .slice(0, limit)

/**
 * Fill the reference layer's slots from one layer's contours.
 *
 * Area rank alone pairs whichever shapes happen to sort the same, and across
 * thresholds that is rarely the same feature - the morph reads as slush.
 * Taking the cheapest pairings first by centroid distance and size difference
 * keeps a feature mapped to itself.
 *
 * @param {Measured[]} layer
 * @param {Measured[]} reference
 * @param {number} extent Scale the costs are measured against
 * @returns {(Measured | null)[]}
 */
const assign_to_slots = (layer, reference, extent) => {
  const pairings = []
  for (const [slot, target] of reference.entries())
    for (const contour of layer)
      pairings.push({
        slot,
        contour,
        cost:
          Math.hypot(
            contour.middle[0] - target.middle[0],
            contour.middle[1] - target.middle[1]
          ) /
            extent +
          Math.abs(Math.sqrt(contour.area) - Math.sqrt(target.area)) / extent
      })
  pairings.sort((first, second) => first.cost - second.cost)

  const slots = Array.from({ length: reference.length }, () => null)
  const used = new Set()
  for (const { slot, contour } of pairings) {
    if (slots[slot] || used.has(contour)) continue
    slots[slot] = contour
    used.add(contour)
  }
  return slots
}

/**
 * Rebuild a set of path strings so every one of them shares a command
 * signature, and morphing between any two is a plain `d` interpolation.
 *
 * @param {string[]} paths
 * @param {Object} [options]
 * @param {number} [options.contours] Shapes kept per layer, largest first
 * @param {number} [options.segments] Cubics per shape; derived from the
 *   payload budget when not given
 * @param {number} [options.precision] Decimal places in the output
 * @param {'position' | 'area'} [options.pairing] How slots get filled
 * @returns {string[]}
 */
export const normalize_set = (paths, options = {}) => {
  const {
    contours = DEFAULT_CONTOURS,
    precision = DEFAULT_PRECISION,
    pairing = 'position'
  } = options

  const layers = paths.map(d => as_measured_contours(d, contours))
  // The layer holding the most shapes sets the slots everyone else fills
  const reference = layers.reduce(
    (most, layer) => (layer.length > most.length ? layer : most),
    layers[0] ?? []
  )
  const count = reference.length
  if (count === 0) return paths.map(() => '')

  const extent = Math.max(
    ...layers.flat().map(measured => Math.sqrt(measured.area)),
    1
  )

  const filled = layers.map(layer => {
    if (layer === reference || pairing === 'area')
      return Array.from(
        { length: count },
        (unused, slot) => layer[slot] ?? null
      )
    return assign_to_slots(layer, reference, extent)
  })

  const reference_shapes = filled[layers.indexOf(reference)].map(
    (measured, slot) => measured ?? reference[slot]
  )

  // Every layer is rebuilt to the same shape count. Segments are picked per
  // slot, not once for the whole set, and follow whichever layer's actual
  // contour in that slot is the most complex - not just the reference's.
  const segments = options.segments
    ? Array.from({ length: count }, () => options.segments)
    : segments_for_slots(filled, count)

  return filled.map(layer =>
    as_path_data(
      layer.map((measured, slot) => {
        const target = reference_shapes[slot]
        const slot_segments = segments[slot] ?? MIN_SEGMENTS
        if (!measured) return as_point_contour(target.middle, slot_segments)

        const reverse = !measured.clockwise
        if (measured === target)
          return resample(measured.polyline, slot_segments, 0, reverse)

        // Closed contours start at an arbitrary vertex. Left alone, two shapes
        // that match perfectly still twist as one morphs into the other, so
        // rotate the start to wherever it tracks the reference most closely.
        const aim = resample(
          target.polyline,
          slot_segments,
          0,
          !target.clockwise
        )
        let phase = 0
        let best = Infinity
        for (let attempt = 0; attempt < PHASE_ATTEMPTS; attempt++) {
          const offset = (attempt / PHASE_ATTEMPTS) * measured.polyline.total
          let cost = 0
          for (let segment = 0; segment < slot_segments; segment++) {
            const walked = at_length(
              measured.polyline,
              offset +
                (reverse ? -1 : 1) *
                  (segment / slot_segments) *
                  measured.polyline.total
            )
            const wanted = aim.cubics[segment]
            const [aim_x, aim_y] = end_of(wanted)
            cost += (walked[0] - aim_x) ** TWO + (walked[1] - aim_y) ** TWO
          }
          if (cost >= best) continue
          best = cost
          phase = offset
        }
        return resample(measured.polyline, slot_segments, phase, reverse)
      }),
      precision
    )
  )
}

/**
 * Which densities a layer visits during a morph, as a full there-and-back
 * sweep of every layer rather than a round trip to just its neighbor -
 * light visits regular, then medium, then bold, then unwinds back through
 * medium and regular to light again. Still crosses one threshold at a time
 * (a triangle wave, not a wrap), so the poster stays readable - jumping
 * straight from bold back to light would pass through an abstract middle.
 * Each layer starts its own sweep from its own position, so all four are
 * out of phase with each other, and every sweep still ends back on the
 * layer's own shape.
 *
 * @param {number} index Layer position in the set
 * @param {number} count How many layers there are
 * @returns {number[]}
 */
export const breathing_order = (index, count) => {
  if (count <= 1) return [index]
  const period = TWO * (count - 1)
  const at = step => {
    const distance = step % period
    return distance < count ? distance : period - distance
  }
  return Array.from({ length: period + 1 }, (unused, step) => at(index + step))
}

/**
 * KeyTimes for a values list, as SMIL wants them. Evenly spaced, unless `hold`
 * reserves a final fraction of the cycle - then the earlier frames spread over
 * what remains and the last frame rests there until the loop restarts.
 * @param {number} frames
 * @param {number} [hold] Fraction of the cycle spent resting on the last frame
 * @returns {string}
 */
export const as_key_times = (frames, hold = 0) => {
  const spread = hold ? frames - 2 : frames - 1
  const travel = 1 - hold
  return Array.from({ length: frames }, (unused, i) =>
    String(
      round_to(i === frames - 1 ? 1 : (i / spread) * travel, KEY_TIME_PRECISION)
    )
  ).join(';')
}
