import { readFileSync as read_file_sync } from "node:fs"
import { join } from "node:path"
import { oklch_hex } from "../../../bin/lib/palette.js"

const required = "background surface raised text document-text muted accent success error warning working secondary cursor selection selection-text syntax-comment syntax-secondary-text syntax-strong-text syntax-bright-text syntax-string syntax-number syntax-keyword syntax-special syntax-cyan terminal-black terminal-white terminal-bright-black terminal-bright-white terminal-bright-error terminal-bright-success terminal-bright-warning terminal-bright-working terminal-bright-secondary surface-glass contrast code-surface muted-text success-tint error-tint warning-tint".split(" ")

/** Only simple local names become output filenames or Lua strings. */
export const theme_name = name => {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`invalid theme name: ${name}`)
  return name
}

/** Read a client's palette and both role maps once; reject incomplete mappings. */
export const load_theme = (directory, name) => {
  theme_name(name)
  const palette = read_file_sync(join(directory, "palette.css"), "utf8")
  const mappings = JSON.parse(read_file_sync(join(directory, "roles.json"), "utf8"))
  const materials = {}
  for (const [, key, L, C, H] of palette.matchAll(/--([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)) {
    const values = [Number(L), Number(C), Number(H)]
    if (values[0] > 1 || values[1] > 0.4 || values[2] > 360) throw new Error(`invalid material: ${key}`)
    if (materials[key]) throw new Error(`duplicate material: ${key}`)
    materials[key] = { values, hex: oklch_hex(...values) }
  }
  const material = key => {
    if (!materials[key]) throw new Error(`unknown material: ${key}`)
    return materials[key]
  }
  const schemes = {}
  for (const scheme of ["light", "dark"]) {
    const mapping = mappings[scheme]
    if (!mapping) throw new Error(`missing scheme: ${scheme}`)
    for (const role of required) if (!Object.hasOwn(mapping, role)) throw new Error(`missing ${scheme} role: ${role}`)
    const roles = {}
    const css_roles = {}
    for (const [role, value] of Object.entries(mapping)) {
      if (typeof value === "string") {
        roles[role] = material(value).hex
        css_roles[role] = `var(--${value})`
      } else if (value && typeof value.tint === "string") {
        const [L] = material(mapping.raised).values
        const [, C, H] = material(value.tint).values
        roles[role] = `oklch(${L} ${Math.min(C, 0.04)} ${H})`
        css_roles[role] = roles[role]
      } else if (value && Array.isArray(value.mix) && value.mix.length === 3) {
        const [from, percent, to] = value.mix
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error(`invalid mix: ${role}`)
        const reference = key => {
          if (key === "transparent") return key
          const swatch = value.materials ? key : mapping[key]
          material(swatch)
          return `var(--${swatch})`
        }
        css_roles[role] = `color-mix(in srgb, ${reference(from)} ${percent}%, ${reference(to)})`
      } else throw new Error(`invalid role: ${role}`)
    }
    schemes[scheme] = { name, scheme, roles, css_roles }
  }
  return { name, palette, schemes }
}
