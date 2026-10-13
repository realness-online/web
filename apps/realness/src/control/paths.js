import { project_root } from '#root/src/settings/layout.js'

/** Checkout paths share the product layout; guest workdirs remain control settings. */
export const ROOT = project_root
export const at = (...parts) => [ROOT, ...parts].join('/')
