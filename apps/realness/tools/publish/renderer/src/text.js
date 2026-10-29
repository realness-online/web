/** Escape plain text for HTML text nodes and quoted attributes. */
export const escape_html = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const minor_words = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'so',
  'the',
  'to',
  'up',
  'with',
  'yet'
])

export const title_case = str => {
  const words = str.split(' ')
  return words
    .map((word, i) => {
      if (
        i !== 0 &&
        i !== words.length - 1 &&
        minor_words.has(word.toLowerCase())
      )
        return word.toLowerCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export const format_date = str => {
  if (!str) return ''
  return new Date(`${str.split('T')[0]}T12:00:00Z`).toLocaleDateString('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
