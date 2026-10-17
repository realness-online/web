/**
 * Environment config: where halos live.
 *
 * `local` is a Linux VM on this Mac, made by Lima. `development` is a VM in the
 * realness-development project, made by gcloud. `production` waits for promotion. Both implement the same verbs - make a halo, put the code on it, run
 * the halo on it, take it away - so the environment picks *where*, not
 * *which command*.
 *
 * A command names its environment explicitly and there is no default, so a typo
 * fails instead of quietly running against prod.
 *
 *    node tools/control/bin/webspace.js local halo up lima-1
 *    node tools/control/bin/webspace.js development halo up realness-2 --smoke
 */

import {
  environment_settings,
  local_settings
} from '#root/src/settings/environments.js'

const development = environment_settings('development')
const production = environment_settings('production')

export const ENVIRONMENTS = {
  local: {
    target: 'lima',
    /** Local halos use the development cloud: its project and sync bucket. */
    project: development.project,
    storage: development.services.bucket,
    /** The Lima VM that is the halo. */
    vm: 'fc-local',
    /**
     * Where this project is inside the guest. Lima mirrors the Mac's cwd, and a
     * deep path fails with `cd: No such file or directory`, so every guest call
     * passes this as --workdir.
     */
    workdir: '/mnt/fc',
    /** The halo's copy of the project, as the guest sees it. */
    root: '/mnt/fc',
    /** The API, through Lima's port forward: guest 8080 -> Mac 18080. */
    api: `http://127.0.0.1:${local_settings.api_port}`,
    /** Sizes for the stack the halo runs. */
    volume: '/opt/fc/actors',
    volumeSize: '6G',
    /**
     * o5: the Cloud Run services Realness runs, and where billing lands.
     * billing is the BigQuery billing export table, "project.dataset.table";
     * null until the export is enabled in the console.
     */
    cloud: {
      project: development.project,
      region: development.services.region,
      services: [],
      billing:
        'realness-development.billing_export.gcp_billing_export_v1_01F763_9EF3F8_28E859',
      openrouter: { key_secret: 'OPENROUTER_API_KEY' },
      expected: [
        'Cloud Run',
        'Cloud Storage',
        'App Engine',
        'Firebase Hosting',
        'Identity Platform',
        'Secret Manager',
        'Cloud Build',
        'Artifact Registry',
        'BigQuery',
        'Cloud Logging',
        'Invoice'
      ]
    },
    /** o7: when `status` calls for attention. */
    attention: {
      free_pct: 15,
      mem_available_bytes: 2 * 1024 ** 3,
      spend_day: 5,
      quiet_running_h: 2,
      deep_loop: 2,
      loop_deadline_min: 60
    }
  },

  development: {
    name: 'development',
    target: 'gcp',
    project: development.project,
    /** Sync's bucket: halo record keys land here. */
    storage: development.services.bucket,
    /** Default zone. Capacity is per machine type per zone; `probe` says which. */
    zone: 'us-east1-b',
    imageFamily: 'realness-halo',
    machineType: 'n2-standard-4',
    bootSize: '20GB',
    actorsSize: '30GB',
    /** Where bundles ship before a halo is dropped. */
    bucket: 'realness-development-realness',
    /** The halo's copy of the project. */
    root: '~/realness',
    /** Loopback-only until h1 exists, so the API is reached over ssh. */
    api: `http://127.0.0.1:${local_settings.halo_port}`,
    haloExports: '/opt/fc/actors/mnt/exports',
    /**
     * o5: the Cloud Run services Realness runs, and where billing lands.
     * billing is the BigQuery billing export table, "project.dataset.table";
     * null until the export is enabled in the console.
     */
    cloud: {
      project: development.project,
      region: development.services.region,
      services: [],
      billing: null,
      openrouter: { key_secret: 'OPENROUTER_API_KEY' },
      expected: [
        'Cloud Run',
        'Cloud Storage',
        'App Engine',
        'Firebase Hosting',
        'Identity Platform',
        'Secret Manager',
        'Cloud Build',
        'Artifact Registry',
        'BigQuery',
        'Cloud Logging',
        'Invoice',
        'Compute Engine'
      ]
    },
    /** o7: when `status` calls for attention. */
    attention: {
      free_pct: 15,
      mem_available_bytes: 2 * 1024 ** 3,
      spend_day: 5,
      quiet_running_h: 2,
      deep_loop: 2,
      loop_deadline_min: 60
    }
  },

  /**
   * pr2: changing commands need --approved. Missing at preflight (2026-10-15):
   * the realness-halo image, the bundle bucket, sync/proxy/gate services, and
   * the HALO_PASS_SECRET and MODEL_PASS_SECRET secrets.
   */
  production: {
    name: 'production',
    target: 'gcp',
    approval: true,
    /** pr3: ssh goes through IAP once `halo lockdown --apply` has run. */
    iap: true,
    project: production.project,
    storage: production.services.bucket,
    zone: 'us-west2-a',
    imageFamily: 'realness-halo',
    machineType: 'n2-standard-4',
    bootSize: '20GB',
    actorsSize: '30GB',
    bucket: 'realness-online-realness',
    root: '~/realness',
    api: `http://127.0.0.1:${local_settings.halo_port}`,
    haloExports: '/opt/fc/actors/mnt/exports',
    cloud: {
      project: production.project,
      region: production.services.region,
      services: ['realness-sync', 'realness-proxy', 'realness-gate'],
      billing: null,
      openrouter: { key_secret: 'OPENROUTER_API_KEY' },
      expected: [
        'Cloud Run',
        'Cloud Storage',
        'App Engine',
        'Firebase Hosting',
        'Identity Platform',
        'Secret Manager',
        'Cloud Functions',
        'Compute Engine',
        'Invoice'
      ]
    },
    attention: {
      free_pct: 15,
      mem_available_bytes: 2 * 1024 ** 3,
      spend_day: 5,
      quiet_running_h: 2,
      deep_loop: 2,
      loop_deadline_min: 60
    }
  }
}

/** Old names fail loudly; `dev` used to mean Lima, which reads as cloud now. */
const RENAMED = { dev: 'local', prod: 'development' }

export const environment = name => {
  const config = ENVIRONMENTS[name]
  if (Object.hasOwn(RENAMED, name))
    throw new Error(`"${name}" was renamed - use "${RENAMED[name]}"`)
  if (!config) {
    const known = Object.keys(ENVIRONMENTS).join(', ')
    throw new Error(`unknown environment "${name}" - expected one of: ${known}`)
  }
  return config
}

/** Does this environment make halos with Lima? */
export const isLocal = config => config.target === 'lima'
