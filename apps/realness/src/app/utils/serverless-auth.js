import {
  RecaptchaVerifier,
  signInWithPhoneNumber as sign_in_with_phone_number,
  getAuth as get_auth,
  onAuthStateChanged as on_auth_state_changed,
  signOut as sign_out
} from 'firebase/auth'
import { from_e64 } from '@/utils/person-identity'
import { auth, current_user, me, init_serverless } from '@/utils/serverless'
import { browser_settings } from '../../settings/environments.js'
import { realness_sign_in } from '@/utils/realness-sign-in'

const sign_in_url = () => {
  try {
    return browser_settings(import.meta.env.MODE).sign_in_url
  } catch {
    return undefined
  }
}

/** Realness's own sign-in where the mode names one; Firebase everywhere else. */
const own = sign_in_url() ? realness_sign_in(sign_in_url()) : null

/** Own sign-in needs no captcha: `verify()` goes straight to its callback. */
class NoCaptcha {
  constructor(_auth, _element, { callback }) {
    this.callback = callback
  }
  verify() {
    this.callback()
  }
}

export const Recaptcha = own ? NoCaptcha : RecaptchaVerifier
export const sign_in = own
  ? (_auth, phone) => own.sign_in(phone)
  : sign_in_with_phone_number

export const sign_off = () => {
  if (own) return own.sign_out()
  if (auth.value) sign_out(auth.value)
}

/** Load the profile before `current_user`, so sync/save hooks never upload a shell over the server file. */
const signed_in = async user => {
  const phone = user.phoneNumber
  if (phone) localStorage.me = from_e64(phone)
  if (me.value) me.value.id = localStorage.me
  /** @type {import('@/types').Item | null} */
  let maybe_me = null
  const { load, load_from_network } = await import('@/utils/itemid')
  try {
    maybe_me = await load_from_network(localStorage.me)
  } catch (err) {
    console.error('[auth] load_from_network failed', err)
  }
  if (!maybe_me) maybe_me = await load(localStorage.me).catch(() => null)
  // eslint-disable-next-line require-atomic-updates
  if (maybe_me) me.value = maybe_me
  current_user.value = user
}

export const init_auth = async () => {
  const firebase_app = await init_serverless()
  if (own) {
    auth.value = /** @type {any} */ ({ own: true })
    return new Promise(resolve => {
      let resolved = false
      own.on_change(async user => {
        if (user) await signed_in(/** @type {any} */ (user))
        else current_user.value = null
        if (!resolved) {
          resolved = true
          resolve(undefined)
        }
      })
    })
  }
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
      if (user) await signed_in(user)
      else
        current_user.value =
          /** @type {import('firebase/auth').User | null} */ (null)
      if (!resolved) {
        resolved = true
        resolve(undefined)
      }
    })
  })
}
