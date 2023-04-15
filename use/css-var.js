export default name => {
  return getComputedStyle(document.documentElement).getPropertyValue(name)
}
