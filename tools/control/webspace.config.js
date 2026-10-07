/**
 * Environment config: where hosts live.
 *
 * `local` is a Linux VM on this Mac, made by Lima. `development` is a VM in the
 * realness-development project, made by gcloud. `production` waits for promotion. Both implement the same verbs - make a host, put the code on it, run
 * the host on it, take it away - so the environment picks *where*, not
 * *which command*.
 *
 * A command names its environment explicitly and there is no default, so a typo
 * fails instead of quietly running against prod.
 *
 *    node tools/control/bin/webspace.js local host up lima-1
 *    node tools/control/bin/webspace.js development host up brayness-2 --smoke
 */

export const ENVIRONMENTS = {
  local: {
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
    /** Sizes for the stack the host runs. */
    volume: "/opt/fc/actors",
    volumeSize: "6G",
    /**
     * o5: the Cloud Run services Brayness runs, and where billing lands.
     * billing is the BigQuery billing export table, "project.dataset.table";
     * null until the export is enabled in the console.
     */
    cloud: {
      project: "realness-development",
      region: "us-central1",
      services: ["brayness-sync", "brayness-proxy"],
      billing: "realness-development.billing_export.gcp_billing_export_v1_01F763_9EF3F8_28E859",
      // o8: the proxy's own OpenRouter key, in this project; it reads its own totals.
      openrouter: { key_secret: "OPENROUTER_API_KEY" },
      // o8: services this environment's bill may charge; any other with cost is flagged.
      expected: ["Cloud Run", "Cloud Storage", "App Engine", "Firebase Hosting", "Identity Platform", "Secret Manager", "Cloud Build", "Artifact Registry", "BigQuery", "Cloud Logging", "Invoice"],
    },
    /** o7: when `status` calls for attention. */
    attention: { free_pct: 15, mem_available_bytes: 2 * 1024 ** 3, spend_day: 5, quiet_running_h: 2, deep_loop: 2, loop_deadline_min: 60 },
  },

  development: {
    target: "gcp",
    project: "realness-development",
    /** Default zone. Capacity is per machine type per zone; `probe` says which. */
    zone: "us-east1-b",
    imageFamily: "brayness-host",
    machineType: "n2-standard-4",
    bootSize: "20GB",
    actorsSize: "30GB",
    /** Where bundles ship before a host is dropped. */
    bucket: "realness-development-brayness",
    /** The host's copy of the project. */
    root: "~/brayness",
    /** Loopback-only until h1 exists, so the API is reached over ssh. */
    api: "http://127.0.0.1:8080",
    hostExports: "/opt/fc/actors/mnt/exports",
    /**
     * o5: the Cloud Run services Brayness runs, and where billing lands.
     * billing is the BigQuery billing export table, "project.dataset.table";
     * null until the export is enabled in the console.
     */
    cloud: {
      project: "realness-development",
      region: "us-central1",
      services: ["brayness-sync", "brayness-proxy"],
      // Production keeps its own billing account; null until its export is on.
      billing: null,
      // o8: production's own proxy key.
      openrouter: { key_secret: "OPENROUTER_API_KEY" },
      // o8: production also runs host VMs.
      expected: ["Cloud Run", "Cloud Storage", "App Engine", "Firebase Hosting", "Identity Platform", "Secret Manager", "Cloud Build", "Artifact Registry", "BigQuery", "Cloud Logging", "Invoice", "Compute Engine"],
    },
    /** o7: when `status` calls for attention. */
    attention: { free_pct: 15, mem_available_bytes: 2 * 1024 ** 3, spend_day: 5, quiet_running_h: 2, deep_loop: 2, loop_deadline_min: 60 },
  },
}

/** Old names fail loudly; `dev` used to mean Lima, which reads as cloud now. */
const RENAMED = { dev: "local", prod: "development" }

export const environment = (name) => {
  const config = ENVIRONMENTS[name]
  if (Object.hasOwn(RENAMED, name)) throw new Error(`"${name}" was renamed - use "${RENAMED[name]}"`)
  if (!config) {
    const known = Object.keys(ENVIRONMENTS).join(", ")
    throw new Error(`unknown environment "${name}" - expected one of: ${known}`)
  }
  return config
}

/** Does this environment make hosts with Lima? */
export const isLocal = (config) => config.target === "lima"