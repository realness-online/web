import firebase from 'firebase/compat/app'
const RecaptchaVerifier = class {
  verify() {
    // console.log('RecaptchaVerifier.verify');
  }
}
firebase.auth_mock = {
  get currentUser() {
    return firebase.user
  },
  onAuthStateChanged: vi.fn(state => state(firebase.user)),
  signInWithPhoneNumber: vi.fn(() => Promise.resolve('success')),
  signOut: vi.fn()
}
firebase.auth = vi.fn(() => firebase.auth_mock)
firebase.auth.RecaptchaVerifier = RecaptchaVerifier
firebase.user = null
