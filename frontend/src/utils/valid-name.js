/** @param {string | null | undefined} name */
export const name_error = name => {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return 'Name is required'
  if (trimmed.length < 3) return 'At least 3 characters'
  return null
}

/** @param {string | null | undefined} name */
export const valid_name = name => !name_error(name)
