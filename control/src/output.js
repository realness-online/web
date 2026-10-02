// One output path for operator results and progress.
let json_output = false

export function set_json_output(value) {
  json_output = value
}

export function mask_phones(value) {
  // Also the URL-encoded form, %2B1415..., which request logs carry.
  return String(value).replace(/(\+|%2B)([1-9])\d{5,13}(\d\d)(?!\d)/gi, (_, plus, first, last) => `${plus}${first}***${last}`)
}

export function redact(value) {
  if (typeof value === "string") return mask_phones(value)
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [mask_phones(key), redact(item)]))
  return value
}

export function progress(text) {
  const destination = json_output ? process.stderr : process.stdout
  destination.write(mask_phones(text))
}

export function result(value, text) {
  process.stdout.write(`${json_output ? JSON.stringify(redact(value)) : mask_phones(text)}\n`)
}
