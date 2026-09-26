/**
 * What never syncs: dependencies, builds, auth files, secrets, and git,
 * which carries repos itself. Names match any path segment.
 */
const NAMES = new Set([
  ".git", "node_modules", ".venv", "__pycache__", ".DS_Store",
  "dist", "build", ".next", ".nuxt", ".output", ".cache", "coverage",
  "auth.json", ".npmrc", ".netrc", "credentials.json", "service-account.json",
  ".can-sync.json", ".can-base",
])
const PATTERNS = [/^\.env(\..+)?$/, /\.(pem|key|p12|pfx)$/, /^id_(rsa|ed25519|ecdsa)(\.pub)?$/, /\.tmp$/]

export const skipped_name = (name) => NAMES.has(name) || PATTERNS.some((pattern) => pattern.test(name))

/** A `/`-separated relative path is skipped if any segment is. */
export const skipped = (path) => path.split("/").some(skipped_name)
