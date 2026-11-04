/** P0/P1 paths from the web-realness reference. */
const PRIORITY_PREFIXES = [
  ['P0', 'src/utils/itemid'],
  ['P0', 'src/utils/itemid-parse'],
  ['P0', 'src/utils/serverless'],
  ['P0', 'src/persistence/'],
  ['P0', 'src/use/sponsor'],
  ['P0', 'src/use/sync'],
  ['P1', 'src/use/poster'],
  ['P1', 'src/potrace/'],
  ['P1', 'src/3d/'],
  ['P1', 'src/utils/export-poster'],
  ['P1', 'src/views/']
]

/**
 * @param {string} path
 * @returns {'P0' | 'P1' | 'P2'}
 */
export const product_priority = path => {
  const plain = path.replace(/^src\/app\//, 'src/')
  return PRIORITY_PREFIXES.find(([, prefix]) => plain.startsWith(prefix))?.[0] ?? 'P2'
}

/** Fallow ranks a file for its importers alone; a small, stable file is not a defect. */
const COUPLING_ONLY = new Set(['split_high_impact'])

/**
 * A refactoring target worth acting on: complexity or coverage, never coupling alone.
 * @param {{ path: string, category: string }} target
 */
export const actionable_target = target => target.path.startsWith('src/') && !COUPLING_ONLY.has(target.category)

const BONUS = { P0: 15, P1: 8, P2: 0 }

/**
 * How urgently a file needs tests before a refactor; higher is sooner, -1 is unused.
 * @param {object} file
 * @param {string} file.path
 * @param {number} file.pct coverage percent
 * @param {number} file.threshold coverage gate percent
 * @param {boolean} [file.unused]
 * @param {boolean} [file.has_spec]
 * @param {{ crap_max?: number, crap_above_threshold?: number, fan_in?: number }} [file.scores]
 * @param {{ score?: number }} [file.hotspot]
 * @param {{ priority?: number }} [file.target]
 * @param {{ count?: number }} [file.complexity]
 */
export const risk_score = ({ path, pct, threshold, unused, has_spec, scores, hotspot, target, complexity }) => {
  if (unused) return -1
  return (
    Math.max(0, threshold - pct) * 1.2 +
    Math.min(scores?.crap_max ?? 0, 120) * 0.35 +
    (scores?.crap_above_threshold ?? 0) * 8 +
    (scores?.fan_in ?? 0) * 1.5 +
    (hotspot?.score ?? 0) * 0.4 +
    (target?.priority ?? 0) * 0.25 +
    (complexity?.count ?? 0) * 2 +
    BONUS[product_priority(path)] +
    (has_spec ? 0 : 10)
  )
}
