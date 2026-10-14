const HEX_RADIX = 16
const PALETTE_LENGTH = 16
const rgb = hex =>
  hex
    .replace('#', '')
    .match(/../g)
    .map(channel => parseInt(channel, HEX_RADIX))

/** Theme text to `{ background, foreground, cursor, ..., palette }`. Throws when incomplete. */
export const parse_theme = text => {
  /** @type {{ palette: number[][], [key: string]: number[] | number[][] }} */
  const theme = { palette: [] }
  for (const line of text.split('\n')) {
    const match = /^\s*([\w-]+)\s*=\s*(.+?)\s*$/.exec(line)
    if (!match || line.trim().startsWith('#')) continue
    const [, key, value] = match
    if (key === 'palette') {
      const [index, hex] = value.split('=')
      theme.palette[Number(index)] = rgb(hex)
    } else theme[key.replace(/-color$/, '').replace(/-/g, '_')] = rgb(value)
  }
  const missing = ['background', 'foreground', 'cursor'].filter(
    key => !theme[key]
  )
  if (missing.length || theme.palette.filter(Boolean).length !== PALETTE_LENGTH)
    throw new Error(
      `incomplete Ghostty theme: ${missing.join(', ') || 'palette'}`
    )
  return theme
}

/** The realness theme for the page's color scheme, fetched beside this module. */
export const realness_theme = async scheme => {
  const response = await fetch(new URL(`./realness-${scheme}`, import.meta.url))
  if (!response.ok)
    throw new Error(`theme realness-${scheme}: ${response.status}`)
  return parse_theme(await response.text())
}
