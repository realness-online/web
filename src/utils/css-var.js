export default name => {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function')
    return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name)
}
