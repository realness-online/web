/** Paths, resolved from this file, so a command works from anywhere. */
export const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "")

/** A path inside the project. */
export const at = (...parts) => [ROOT, ...parts].join("/")