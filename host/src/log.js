// One line per event on stdout, in the shape the Python host wrote.

function line(level, name, parts) {
  const text = parts.map((part) => (part instanceof Error ? part.stack : String(part))).join(" ")
  process.stdout.write(`${new Date().toISOString()} ${level} ${name} ${text}\n`)
}

export function logger(name) {
  return {
    info: (...parts) => line("INFO", name, parts),
    warn: (...parts) => line("WARNING", name, parts),
    error: (...parts) => line("ERROR", name, parts),
  }
}
