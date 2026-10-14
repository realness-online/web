/** Whether `text` holds a NUL or any other control character. */
export const has_control = text => [...text].some(char => char < ' ')

/** A percent escape, which could spell a separator once decoded. */
export const has_escape = part => /%[0-9a-f]{2}/i.test(part)

/** A path segment that is empty, a dot name, or carries a backslash or NUL. */
export const unsafe_part = part =>
  !part ||
  part === '.' ||
  part === '..' ||
  part.includes('\\') ||
  part.includes('\0')
