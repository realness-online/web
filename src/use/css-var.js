export default function(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name)
}
