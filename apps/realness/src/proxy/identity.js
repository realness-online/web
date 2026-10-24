import { identify, google_certs } from '#root/src/can/index.js'
import { create_gcs, gcloud_token, metadata_token } from '#root/src/can/gcs.js'
import { PINS_REALNESS, storage_pins } from '#root/src/sync/server.js'
import { token_trust } from '#root/src/sign-in/trust.js'

/**
 * Identify the person behind a token. Pins live in the given store, or in the bucket.
 * @param {{ project?: string, bucket?: string, token?: () => Promise<string | null>, storage?: object, certs?: () => Promise<Record<string, string>>, issuer?: string }} options
 */
export const phone_identity = ({
  project,
  bucket,
  token,
  storage,
  ...trust
}) => {
  const { certs = google_certs(), issuer } = {
    ...token_trust(project),
    ...trust
  }
  const pins_storage =
    storage ??
    (bucket
      ? create_gcs({
          bucket,
          token:
            token ?? (process.env.K_SERVICE ? metadata_token() : gcloud_token())
        })
      : null)
  if (!project || !pins_storage)
    throw new Error('phone identity needs a project and a pin store')
  const pins = storage_pins(pins_storage, issuer ? PINS_REALNESS : undefined)
  return id_token => identify(id_token, { project, certs, issuer, pins })
}
