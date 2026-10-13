import {
  RecaptchaVerifier,
  signInWithPhoneNumber as sign_in_with_phone_number,
  getAuth as get_auth,
  onAuthStateChanged as on_auth_state_changed,
  signOut as sign_out
} from 'firebase/auth'
import { from_e64 } from '@/utils/person-identity'
import { auth, current_user, me } from '@/utils/serverless'

export const Recaptcha = RecaptchaVerifier
export const sign_in = sign_in_with_phone_number

export const sign_off = () => {
  if (auth.value) sign_out(auth.value)
}

/**
 * @param {import('firebase/app').FirebaseApp | undefined} firebase_app
 */
export const init_auth = firebase_app => {
  if (!firebase_app) {
    current_user.value = null
    return Promise.resolve(undefined)
  }

  auth.value = get_auth(firebase_app)

  return new Promise(resolve => {
    let resolved = false
    if (!auth.value) {
      current_user.value = null
      resolve(undefined)
      return
    }
    on_auth_state_changed(auth.value, async user => {
      if (user) {
        const phone = user.phoneNumber
        if (phone) localStorage.me = from_e64(phone)
        if (me.value) me.value.id = localStorage.me
        /** Load profile before `current_user` so sync/save hooks do not upload a shell over the server file. */
        /** @type {import('@/types').Item | null} */
        let maybe_me = null
        try {
          const { load_from_network } = await import('@/utils/itemid')
          maybe_me = await load_from_network(localStorage.me)
        } catch (err) {
          console.error('[auth] load_from_network failed', err)
        }
        // eslint-disable-next-line require-atomic-updates
        if (maybe_me) me.value = maybe_me
        current_user.value = user
      } else
        current_user.value =
          /** @type {import('firebase/auth').User | null} */ (null)
      if (!resolved) {
        resolved = true
        resolve(undefined)
      }
    })
  })
}
