/** Luminosity targets for shadow gradient layers (0-100). */
export const shadow_luminosity = {
  background: 81,
  light: 60,
  regular: 44,
  medium: 20,
  bold: 10
}

/** @type {Record<string, string>} */
export const shadow_value_hint = {
  bold: `0-${shadow_luminosity.bold}% luminosity`,
  medium: `${shadow_luminosity.bold}-${shadow_luminosity.medium}% luminosity`,
  regular: `${shadow_luminosity.medium}-${shadow_luminosity.regular}% luminosity`,
  light: `${shadow_luminosity.regular}-${shadow_luminosity.light}% luminosity`,
  background: `${shadow_luminosity.background}% luminosity fill`
}
