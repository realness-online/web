import { initializeApp } from 'firebase/app'
import {
  RecaptchaVerifier,
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut
} from 'firebase/auth'
import { ref } from 'vue'

/** The public client config. Every value is safe to ship in a page. */
const config = {
  apiKey: import.meta.env.VITE_API_KEY,
  appId: import.meta.env.VITE_APP_ID,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID
}

let instance

export const auth = ref(
  /** @type {import('firebase/auth').Auth | undefined} */ (undefined)
)
export const current_user = ref(
  /** @type {import('firebase/auth').User | null | undefined} */ (undefined)
)

/** Built on first use, so importing this module needs no config. */
export const init_auth = () => {
  if (instance) return instance
  instance = getAuth(initializeApp(config))
  auth.value = instance
  onAuthStateChanged(instance, user => {
    current_user.value = user
  })
  return instance
}

/**
 * An invisible reCAPTCHA attached to `element`.
 * @param {HTMLElement | null} element
 * @param {string} [theme]
 */
export const recaptcha = (element, theme = 'light') =>
  new RecaptchaVerifier(auth.value, element, { size: 'invisible', theme })

/** The modular call, with this page's auth instance bound in. */
export const sign_in = (phone_number, verifier) =>
  signInWithPhoneNumber(auth.value, phone_number, verifier)

export const sign_off = () => auth.value && signOut(auth.value)
