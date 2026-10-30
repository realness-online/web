/**
 * What never syncs: artifacts, local vault metadata, dependencies, builds,
 * caches (npm, Rust `target`), auth files, secrets, shell histories, and git (`.git` and bare `name.git` repositories). Names match any path segment.
 */
const NAMES = new Set([
  'secrets',
  '.obsidian',
  '.smart-env',
  '.git',
  'node_modules',
  '.npm',
  'target',
  '.venv',
  '__pycache__',
  '.DS_Store',
  'artifacts',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  'coverage',
  'auth.json',
  '.npmrc',
  '.netrc',
  'credentials.json',
  'service-account.json'
])
const PATTERNS = [
  /.\.git$/,
  /^\.env(\..+)?$/,
  /\.(pem|key|p12|pfx)$/,
  /^id_(rsa|ed25519|ecdsa)(\.pub)?$/,
  /\.tmp$/,
  /^\.[a-z_]+_history$/,
  /\.html\.gz\.(lock|writer-[^.]+|tail-[^.]+|before-rewrite-[^.]+|before-compaction-[^.]+|writing-[^.]+|compacting-[^.]+)$/
]

/** Shell and REPL histories: personal, never synced or shipped. */
export const is_history = name => /^\.[a-z_]+_history$/.test(name)

export const skipped_name = name =>
  NAMES.has(name) || PATTERNS.some(pattern => pattern.test(name))

/** A `/`-separated relative path is skipped if any segment is. */
export const skipped = path => path.split('/').some(skipped_name)
