export const request_json = req => {
  const { body } = req
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body
  if (typeof body === 'string' && body) return JSON.parse(body)
  return {}
}
