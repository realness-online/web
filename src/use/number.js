export const to_kb = obj => {
  const as_string = JSON.stringify(obj)
  const size_of = new Blob([as_string]).size
  return (size_of / 1024).toFixed(2)
}
