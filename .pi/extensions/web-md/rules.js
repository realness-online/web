
const SKIP = /#\s*web-md:\s*skip/
const URL = /https?:\/\/[^\s'"|;&)]+/g

const CURL_FLAGS = /\s(-X|--request|-d|--data[\w-]*|-F|--form|-o|-O|--output|--remote-name|-I|--head|-T|--upload-file|-u|--user)\b/
const CURL_AUTH = /-H\s*['"]?(authorization|accept:\s*application\/(json|vnd))/i
const DATA_URL = /\/api\/|\/api\.|^https?:\/\/api\.|\.(json|xml|txt|csv|ya?ml|md|tar|gz|tgz|zip|sh|js|css|svg|png|jpe?g|webp|pdf)(\?|$)|raw\.githubusercontent|registry\.npmjs|\/raw\/|\?format=json|\/rss|\/feed|\.rss|localhost|127\.0\.0\.1|0\.0\.0\.0/i

const AB_READ = /agent-browser\b[^|;&]*\bget\s+(text|html)(\s+(['"]?)(body|html|main|article|:root)\3)?\s*($|[|;&>])/m

const curl_reads_page = command => {
  for (const part of command.split(/&&|;|\n/)) {
    if (!/\bcurl\b/.test(part)) continue
    const [curl, ...piped] = part.slice(part.search(/\bcurl\b/)).split('|')
    const urls = curl.match(URL) ?? []
    if (!urls.length) continue
    if (CURL_FLAGS.test(curl) || CURL_AUTH.test(curl)) continue
    if (/^\s*jq\b/.test(piped[0] ?? '')) continue
    const is_data = u => DATA_URL.test(u) && !/\.html?(\?|#|$)/i.test(u)
    if (urls.every(is_data)) continue
    return urls[0]
  }
  return null
}

/**
 * @param {string} command
 * @param {string} web_md absolute path to bin/web/web-md.js
 * @returns {string | null}
 */
export const check = (command, web_md) => {
  if (!command || SKIP.test(command) || /web-md\.js/.test(command)) return null
  const url = curl_reads_page(command)
  if (url)
    return `Blocked: curl reads ${url} as raw HTML. Use \`${web_md} '${url}' --max 4000\` instead; add \`--grep <word>\` to find one fact. If this really is an API or a download, add \`# web-md: skip\` to the command.`
  if (AB_READ.test(command))
    return `Blocked: agent-browser is dumping a whole page. Use \`${web_md} '<url>' --max 4000\` to read pages; agent-browser is for clicking, forms, logins, and screenshots. If this is a local app or a page after interaction, add \`# web-md: skip\` to the command.`
  return null
}
