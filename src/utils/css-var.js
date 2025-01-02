/**
 * Gets the computed value of a CSS variable
 * @param {string} name - The CSS variable name (including --)
 * @returns {string} The computed value of the CSS variable
 */
export default name =>
  getComputedStyle(document.documentElement).getPropertyValue(name)
