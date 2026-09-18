/**
 * Environment config: where hosts live.
 *
 * `dev` is a Linux VM on this Mac, made by Lima. `prod` is a VM in GCP, made by
 * gcloud. Both implement the same verbs - make a host, put the code on it, run
 * the orchestrator on it, take it away - so the environment picks *where*, not
 * *which command*.
 *
 * A command names its environment explicitly and there is no default, so a typo
 * fails instead of quietly running against prod.
 *
 *    node control/bin/webspace.js dev  host up lima-1
 *    node control/bin/webspace.js prod host up brayness-2 --smoke
 */

export const ENVIRONMENTS = {
  dev: {
    target: "lima",
    /** The Lima VM that is the host. */
    vm: "fc-local",
    /**
     * Where this project is inside the guest. Lima mirrors the Mac's cwd, and a
     * deep path fails with `cd: No such file or directory`, so every guest call
     * passes this as --workdir.
     */
    workdir: "/mnt/fc",
    /** The host's copy of the project, as the guest sees it. */
    root: "/mnt/fc",
    /** The API, through Lima's port forward: guest 8080 -> Mac 18080. */
    api: "http://127.0.0.1:18080",
    webPort: 18090,
    log: "runs/dev-up.log",
    /** Sizes for the stack the host runs. */
    volume: "/opt/fc/sessions",
    volumeSize: "6G",
  },

  prod: {
    target: "gcp",
    project: "realness-online",
    /** Default zone. Capacity is per machine type per zone; `probe` says which. */
    zone: "us-central1-a",
    imageFamily: "brayness-host",
    machineType: "n2-standard-4",
    bootSize: "20GB",
    sessionsSize: "30GB",
    /** Where bundles ship before a host is dropped. */
    bucket: "realness-online-brayness",
    /** The host's copy of the project. */
    root: "~/brayness",
    /** Loopback-only until h1 exists, so the API is reached over ssh. */
    api: "http://127.0.0.1:8080",
    hostExports: "/opt/fc/sessions/mnt/exports",
  },
}

export function environment(name) {
  const config = ENVIRONMENTS[name]
  if (!config) {
    const known = Object.keys(ENVIRONMENTS).join(", ")
    throw new Error(`unknown environment "${name}" - expected one of: ${known}`)
  }
  return config
}

/** Does this environment make hosts with Lima? */
export const isLocal = (config) => config.target === "lima"