/**
 * h7: git's credential helper on a VM. Git sends `key=value` lines; for a
 * GitHub https URL this answers with an hour-long token from sync. It never
 * stores one, so `store` and `erase` do nothing.
 *
 *   git config --system credential.https://github.com.helper '!realness git-credential'
 *   git config --system credential.https://github.com.useHttpPath true
 */

/** git's credential description: one `key=value` per line, up to a blank line. */
export const read_description = text => {
  const fields = {}
  for (const line of text.split('\n')) {
    if (!line.trim()) break
    const at = line.indexOf('=')
    if (at > 0) fields[line.slice(0, at)] = line.slice(at + 1).trim()
  }
  return fields
}

/** The helper's answer for one operation, or "" when it has nothing to say. */
export const answer = async (operation, text, { git_token }) => {
  if (operation !== 'get') return ''
  const fields = read_description(text)
  if (fields.protocol !== 'https' || fields.host !== 'github.com') return ''
  if (!fields.path)
    throw new Error(
      'git sent no repo path; set credential.https://github.com.useHttpPath true'
    )
  const { token } = await git_token(fields.path)
  return `username=x-access-token\npassword=${token}\n`
}
