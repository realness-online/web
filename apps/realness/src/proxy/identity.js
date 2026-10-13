import { identify, google_certs } from "#root/src/can/index.js"
import { create_gcs, gcloud_token, metadata_token } from "#root/src/can/gcs.js"
import { storage_pins } from "#root/src/sync/server.js"

export const phone_identity = ({ project, bucket, token, certs = google_certs() }) => {
  if (!project || !bucket) throw new Error("phone identity needs project and bucket")
  const storage = create_gcs({ bucket, token: token ?? (process.env.K_SERVICE ? metadata_token() : gcloud_token()) })
  const pins = storage_pins(storage)
  return (id_token) => identify(id_token, { project, certs, pins })
}
