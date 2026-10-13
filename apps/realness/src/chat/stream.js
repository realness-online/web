/** Decode newline-framed replies, including records split across chunks. */
export async function* records(body) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const chunks = {
    [Symbol.asyncIterator]: () => ({ next: () => reader.read() })
  }
  let pending = ''
  try {
    for await (const value of chunks) {
      pending += decoder.decode(value, { stream: true })
      let end
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).trim()
        pending = pending.slice(end + 1)
        if (line) yield JSON.parse(line)
      }
    }
    pending += decoder.decode()
    if (pending.trim()) yield JSON.parse(pending)
  } finally {
    reader.releaseLock()
  }
}
