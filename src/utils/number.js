/**
 * Converts an object to JSON and returns its size in kilobytes
 * @param {Object} obj - Object to measure
 * @returns {string} Size in KB with 2 decimal places
 */
export const to_kb = obj => {
  const as_string = JSON.stringify(obj)
  const size_of = new Blob([as_string]).size
  return (size_of / 1024).toFixed(2)
}
