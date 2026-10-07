/** Decode newline-framed replies, including records split across chunks. */
export async function* records(body) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      let end
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).trim()
        pending = pending.slice(end + 1)
        if (line) yield JSON.parse(line)
      }
      if (done) {
        if (pending.trim()) yield JSON.parse(pending)
        return
      }
    }
  } finally {
    reader.releaseLock()
  }
}
