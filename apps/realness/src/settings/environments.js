const environments = {
  development: {
    project: 'realness-development',
    public_url: 'https://realness-development.web.app',
    services: {
      region: 'us-central1',
      bucket: 'realness-development.firebasestorage.app',
      sync_url: 'https://brayness-sync-639469569733.us-central1.run.app',
      proxy_url: 'https://brayness-proxy-639469569733.us-central1.run.app',
      gate_url: 'https://brayness-gate-639469569733.us-central1.run.app',
      sites_url: 'https://realness-development-sites.web.app',
      starter_proxy_url: 'https://brayness-proxy-yelzvhhngq-uc.a.run.app',
      origins: 'https://realness-development.web.app,https://realness-development.firebaseapp.com,https://realness.local,http://localhost:5173'
    }
  },
  production: {
    project: 'realness-online',
    public_url: 'https://realness.online'
  }
}

/** Select an environment explicitly; production services remain unconfigured until promotion. */
export const environment_settings = name => {
  if (!Object.hasOwn(environments, name)) throw Error(`unknown environment "${name}"`)
  return environments[name]
}

export const development_settings = environments.development

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
export const deployment_settings = (name, env = process.env) => {
  if (!name) throw Error('deployment environment is required: development|production')
  const selected = environment_settings(name)
  if (!selected.services) throw Error(`service settings for ${name} are not configured`)
  for (const [key, expected] of [['PROJECT', selected.project], ['IDENTITY_PROJECT', selected.project], ['BUCKET', selected.services.bucket]]) {
    if (env[key] && env[key] !== expected) throw Error(`${key} conflicts with ${name}`)
  }
  return {
    project: selected.project,
    identity: selected.project,
    bucket: selected.services.bucket,
    region: env.REGION || selected.services.region,
    origins: env.ORIGINS || selected.services.origins
  }
}
