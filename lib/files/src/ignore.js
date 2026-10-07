/**
 * A person's `.ignore`, read like a small `.gitignore`:
 *
 *   # comment
 *   artifacts/        a folder anywhere, by name (trailing / is folders only)
 *   /drafts           anchored at the harness root
 *   *.mov             globs: * within a name, ** across folders, ? one character
 *   !keep.mov         re-include; the last matching line wins
 *
 * As in git, a file inside an ignored folder stays ignored.
 */

const escape = (text) => text.replace(/[.+^${}()|[\]\\]/g, "\\$&")

const to_regex = (glob) => {
  let out = ""
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]
    if (char === "*" && glob[i + 1] === "*") {
      out += ".*"
      i++
      if (glob[i + 1] === "/") i++
    } else if (char === "*") out += "[^/]*"
    else if (char === "?") out += "[^/]"
    else out += escape(char)
  }
  return out
}

/** Rules from file text; blank lines and comments drop out. */
export const parse_ignore = (text = "") => {
  const rules = []
  for (const raw of text.split("\n")) {
    let line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const negate = line.startsWith("!")
    if (negate) line = line.slice(1)
    const folders_only = line.endsWith("/")
    line = line.replace(/\/+$/, "")
    const anchored = line.startsWith("/") || line.includes("/")
    line = line.replace(/^\/+/, "")
    if (!line) continue
    const body = to_regex(line)
    rules.push({ negate, folders_only, pattern: new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`) })
  }
  return rules
}

/** `(path, is_dir) => boolean` for `/`-separated paths relative to the root. */
export const ignorer = (rules) => {
  const decide = (path, is_dir) => {
    let ignored = false
    for (const rule of rules) {
      if (rule.folders_only && !is_dir) continue
      if (rule.pattern.test(path)) ignored = !rule.negate
    }
    return ignored
  }
  return (path, is_dir = false) => {
    const parts = path.split("/").filter(Boolean)
    for (let i = 1; i <= parts.length; i++) {
      const last = i === parts.length
      if (decide(parts.slice(0, i).join("/"), last ? is_dir : true)) return true
    }
    return false
  }
}
