import { initializeApp as initialize_app } from 'firebase-admin/app'
import { getStorage as get_storage } from 'firebase-admin/storage'

const project_id = process.env.GCLOUD_PROJECT

initialize_app({ storageBucket: `${project_id}.appspot.com` })

export const bucket = get_storage().bucket()
