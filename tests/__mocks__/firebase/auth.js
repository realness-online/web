export const RecaptchaVerifier = class {
  verify() {
    // console.log('RecaptchaVerifier.verify');
  }
}
export let user = null
export const getAuth = vi.fn()
export const onAuthStateChanged = state => user
export const signInWithPhoneNumber = vi.fn(() => Promise.resolve('success'))
export const signOut = vi.fn()
