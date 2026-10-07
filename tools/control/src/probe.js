/**
 * Which (machine type, zone) can actually make a host right now.
 *
 *   webspace development probe
 *   webspace development probe n2-standard-4:us-west1-b n2-standard-8:us-east1-b
 *
 * Capacity is per machine type per zone and a stockout refuses both create and
 * start, so the only honest probe is a create. Each probe makes a 20 GB disk
 * (the fleet image refuses anything smaller) and takes it away again. The full
 * error is printed, because "not available in this zone" and "out of stock"
 * want different answers.
 *
 * Exits non-zero when no candidate can make a host, so this is usable as a
 * check. The shell version took its candidates only from `$@` and so probed
 * nothing when called bare, printing a summary that read like a pass.
 */
import { attempt, step, note } from "./exec.js"

const DEFAULTS = [
  "n2-standard-4:us-central1-a",
  "n2-standard-4:us-central1-b",
  "n2-standard-4:us-central1-c",
  "n2-standard-4:us-west1-a",
  "n2-standard-4:us-west1-b",
  "n2-standard-4:us-east1-b",
]

export const probe = async (config, candidates = []) => {
  const list = candidates.length > 0 ? candidates : DEFAULTS
  step(`${list.length} candidates in ${config.project}`)

  const ok = []
  for (const candidate of list) {
    const [type, zone] = split(candidate)
    const name = `capacity-probe-${type.split("-")[0]}-${zone}`
    const result = await attempt("gcloud", [
      "compute",
      "instances",
      "create",
      name,
      `--project=${config.project}`,
      `--zone=${zone}`,
      `--machine-type=${type}`,
      "--enable-nested-virtualization",
      `--image-family=${config.imageFamily}`,
      "--boot-disk-size=20GB",
      "--boot-disk-type=pd-standard",
      "--no-service-account",
      "--no-scopes",
    ])

    // Clean up either way. A probe that leaves a disk behind bills for it.
    const cleanup = [
      ["instances", "delete", name, `--project=${config.project}`, `--zone=${zone}`, "--quiet"],
      ["disks", "delete", name, `--project=${config.project}`, `--zone=${zone}`, "--quiet"],
    ]
    for (const args of cleanup) await attempt("gcloud", ["compute", ...args])

    if (result.ok) {
      ok.push(candidate)
      note(`OK    ${type.padEnd(18)} ${zone}`)
    } else {
      note(`NO    ${type.padEnd(18)} ${zone.padEnd(14)} ${lastLine(result.err)}`)
    }
  }

  if (ok.length === 0) {
    process.stderr.write(`\nno candidate zone can make a host right now\n`)
    process.stderr.write(`try more: webspace development probe <type>:<zone> ...\n`)
    return { ok: [], failed: list.length }
  }
  note(`${ok.length} of ${list.length} can make a host: ${ok.join(" ")}`)
  return { ok, failed: list.length - ok.length }
}

const split = (candidate) => {
  const [type, zone] = candidate.split(":")
  if (!type || !zone) {
    throw new Error(`expected <machine-type>:<zone>, got "${candidate}"`)
  }
  return [type, zone]
}

const lastLine = (text) => {
  return text
    .trim()
    .split("\n")
    .filter(line => !line.startsWith("WARNING"))
    .slice(-2)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}