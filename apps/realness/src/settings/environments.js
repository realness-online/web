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
  production: {
    project: 'realness-online',
    public_url: 'https://realness.online',
    services: {
      /** Next to the hosts, so the gate-to-host hop stays inside one region. */
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

const browser_modes = {
  development: { gate_url: development_settings.services.gate_url },
  production: { gate_url: environments.production.services.gate_url },
  local: { gate_url: '/gate' }
}

export const browser_settings = mode => {
  const name = mode === 'test' ? 'development' : mode
  if (!Object.hasOwn(browser_modes, name))
    throw Error(`unknown browser mode "${mode}"`)
  return browser_modes[name]
}

export const local_settings = {
  cloud: environments.development,
  host_port: 8080,
  api_port: 18080,
  terminal_port: 18081,
  gate_port: 8792,
  site_port: 18096,
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
