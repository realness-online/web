const environments = {
  development: {
    project: 'realness-development',
    public_url: 'https://realness-development.web.app',
    services: {
      region: 'us-central1',
      bucket: 'realness-development.firebasestorage.app',
      sync_url: 'https://realness-sync-639469569733.us-central1.run.app',
      proxy_url: 'https://realness-proxy-639469569733.us-central1.run.app',
      gate_url: 'https://realness-gate-639469569733.us-central1.run.app',
      sites_url: 'https://realness-development-sites.web.app',
      starter_proxy_url: 'https://realness-proxy-yelzvhhngq-uc.a.run.app',
      hosting_routes: ['realness-sync', 'realness-proxy'],
      origins:
        'https://realness-development.web.app,https://realness-development.firebaseapp.com,https://realness.local,http://localhost:5173'
    }
  },
  local: {
    /** No cloud project has this name; local sign-in issues its tokens. */
    project: 'demo-realness',
    services: {
      /** The halo reaches the Mac's proxy through Lima's host name. */
      proxy_url: 'http://host.lima.internal:8788',
      sync_url: 'http://127.0.0.1:8787',
      /** The halo reaches the Mac's sync through Lima's host name. */
      halo_sync_url: 'http://host.lima.internal:8787',
      /** Actors reach it through a halo port the actor network allows. */
      actor_sync_url: 'http://realness-halo:18098',
      /** Published sites get their own sync folder so they never mix with people. */
      site_sync_url: 'http://127.0.0.1:18096',
      sites_url: 'http://127.0.0.1:18096',
      /** Actors reach it through a halo port the actor network allows. */
      actor_proxy_url: 'http://realness-halo:18097',
      origins: 'https://realness.local,http://localhost:5173'
    }
  },
  production: {
    project: 'realness-online',
    public_url: 'https://realness.online',
    services: {
      /** Next to the halos, so the gate-to-halo hop stays inside one region. */
      region: 'us-west2',
      bucket: 'realness-online.appspot.com',
      sync_url: 'https://realness-sync-276668807926.us-west2.run.app',
      proxy_url: 'https://realness-proxy-276668807926.us-west2.run.app',
      gate_url: 'https://realness-gate-276668807926.us-west2.run.app',
      hosting_routes: [],
      origins:
        'https://realness.online,https://realness-online.web.app,https://realness-online.firebaseapp.com'
    }
  }
}

/** Select an environment explicitly. Production service URLs follow Cloud Run's project-number form. */
export const environment_settings = name => {
  if (!Object.hasOwn(environments, name))
    throw Error(`unknown environment "${name}"`)
  return environments[name]
}

export const development_settings = environments.development

/** The environment people sign on to, sync with, and pay in. */
export const person_settings = environments.production

/**
 * What the browser build talks to. `dev-local` reaches the Mac's own gate,
 * model proxy, sign-in, and storage through the dev server.
 */
const local_proxy_port = 8788

const browser_modes = {
  development: {
    gate_url: development_settings.services.gate_url,
    proxy_url: development_settings.services.proxy_url
  },
  production: {
    gate_url: environments.production.services.gate_url,
    proxy_url: environments.production.services.proxy_url
  },
  'dev-local': {
    gate_url: '/gate',
    proxy_url: '/model',
    sign_in_url: '/sign-in',
    sync_url: '/sync'
  }
}

export const browser_settings = mode => {
  const name = mode === 'test' ? 'development' : mode
  if (!Object.hasOwn(browser_modes, name))
    throw Error(`unknown browser mode "${mode}"`)
  return browser_modes[name]
}

export const local_settings = {
  cloud: environments.local,
  halo_port: 8080,
  api_port: 18080,
  terminal_port: 18081,
  sync_port: 8787,
  proxy_port: local_proxy_port,
  gate_port: 8792,
  sign_in_port: 8793,
  site_port: 18096,
  actor_proxy_port: 18097,
  actor_sync_port: 18098,
  https_port: 443,
  http_port: 5173,
  secure_origin: 'https://realness.local',
  origin: 'http://localhost:5173'
}

/** All services share one target, identity, and bucket; overrides cannot cross environments. */
export const deployment_settings = (name, env = {}) => {
  if (!name)
    throw Error('deployment environment is required: development|production')
  const selected = environment_settings(name)
  if (!selected.services)
    throw Error(`service settings for ${name} are not configured`)
  for (const [key, expected] of [
    ['PROJECT', selected.project],
    ['IDENTITY_PROJECT', selected.project],
    ['BUCKET', selected.services.bucket]
  ])
    if (env[key] && env[key] !== expected)
      throw Error(`${key} conflicts with ${name}`)

  return {
    project: selected.project,
    identity: selected.project,
    bucket: selected.services.bucket,
    region: env.REGION || selected.services.region,
    origins: env.ORIGINS || selected.services.origins,
    sync_url: selected.services.sync_url
  }
}
