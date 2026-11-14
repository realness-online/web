const MARKERS = [
  /realness chrome: (?<why>.+)/,
  /no saved (?<site>yc|swooped|indeed) login.*/,
  /(?<site>yc|swooped|indeed).* may have expired.*/,
  /could not read \S+: .*HTTP (?:401|403)/
]

/**
 * Why a run could not read a login source, as its own log says, or null. A
 * quiet zero from a dead lease is the failure this catches.
 * @param {string} log the run's pi.log
 * @returns {string | null}
 */
export const dead_source = log => {
  const line = String(log ?? '')
    .split('\n')
    .find(text => MARKERS.some(marker => marker.test(text)))
  return line?.trim() ?? null
}
