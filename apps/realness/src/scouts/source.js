const MARKERS = [
  /realness chrome: (?<why>.+)/,
  /no saved (?<site>yc|swooped|indeed) login.*/,
  /(?<site>yc|swooped|indeed).* may have expired.*/,
  /could not read \S+: .*HTTP (?:401|403)/
]
const REFUSED_PAGE = /could not read (\S+): /

/**
 * Whether a refused page is the source itself: a page the source names, or a
 * refusal that names no page. A refused story or hop is one page lost, and the
 * run goes on.
 * @param {string} text
 * @param {string[]} [named] the pages the source names
 */
export const source_refused = (text, named = []) => {
  const page = String(text).match(REFUSED_PAGE)?.[1]
  if (!page) return true
  const bare = url => url.replace(/\/+$/, '')
  return named.some(one => !one.includes('<') && bare(one) === bare(page))
}

/**
 * Why a run could not read a login source, as its own log says, or null. A
 * quiet zero from a dead lease is the failure this catches.
 * @param {string} log the run's pi.log
 * @param {string[]} [named] the pages the source names
 * @returns {string | null}
 */
export const dead_source = (log, named = []) => {
  const line = String(log ?? '')
    .split('\n')
    .find(text =>
      MARKERS.some(
        (marker, at) =>
          marker.test(text) &&
          (at < MARKERS.length - 1 || source_refused(text, named))
      )
    )
  return line?.trim() ?? null
}
