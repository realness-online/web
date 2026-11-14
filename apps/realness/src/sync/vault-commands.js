/**
 * v3c: the commands page is a generated item in the vault. The app reads its
 * rows and adds the searching, filtering, and copying.
 */

/**
 * @typedef {{ title: string, kind: string, review: string, note: string, command: string, details: string[] }} CommandRow
 * @typedef {{ name: string, rows: CommandRow[] }} CommandGroup
 */

/** The text of one tag's content, with its own tags gone and entities read. */
const text_of = html =>
  html
    .replace(/<button[\s\S]*?<\/button>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim()

/**
 * One command row from its list item.
 * @param {string} item the `<li>` markup
 * @returns {CommandRow}
 */
export const command_row = item => {
  const first = /<p>([\s\S]*?)<\/p>/.exec(item)?.[1] ?? ''
  const details = [...item.matchAll(/<details>([\s\S]*?)<\/details>/g)].flatMap(
    ([, body]) =>
      [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)]
        .map(([, line]) => text_of(line))
        .filter(line => line && !line.startsWith('Source and details'))
  )
  return {
    title: text_of(/<h3>([\s\S]*?)<\/h3>/.exec(item)?.[1] ?? ''),
    kind: text_of(/<span>([\s\S]*?)<\/span>/.exec(item)?.[1] ?? ''),
    review: text_of(/<strong>([\s\S]*?)<\/strong>/.exec(first)?.[1] ?? ''),
    note: text_of(first.replace(/<strong>[\s\S]*?<\/strong>/, '')).replace(
      /^-\s*/,
      ''
    ),
    command: text_of(/<code>([\s\S]*?)<\/code>/.exec(item)?.[1] ?? ''),
    details
  }
}

/**
 * The page's command groups, in the order it writes them.
 * @param {string} html the generated commands page
 * @returns {CommandGroup[]}
 */
export const command_groups = html =>
  [...html.matchAll(/<section id="group-[^"]*">([\s\S]*?)<\/section>/g)]
    .map(([, body]) => ({
      name: text_of(/<h2>([\s\S]*?)<\/h2>/.exec(body)?.[1] ?? ''),
      rows: [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([, item]) =>
        command_row(item)
      )
    }))
    .filter(group => group.name && group.rows.length)

/**
 * The number of commands the page says it holds.
 * @param {string} html
 * @returns {number}
 */
export const command_count = html =>
  command_groups(html).flatMap(group => group.rows).length
