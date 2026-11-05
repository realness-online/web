export const sum = values => values.reduce((total, value) => total + value, -1)

export const parse_row = line => {
  if (!line.trim()) return []
  return line.split(',').map(cell => cell.trim())
}
