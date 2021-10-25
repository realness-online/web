import firebase from 'firebase/app'
const RecaptchaVerifier = class {
  verify() {
    // console.log('RecaptchaVerifier.verify');
  }
}
firebase.auth_mock = {
  get currentUser() {
    return firebase.user
  },
  onAuthStateChanged: jest.fn(state => state(firebase.user)),
  signInWithPhoneNumber: jest.fn(() => Promise.resolve('success')),
  signOut: jest.fn()
}
firebase.auth = jest.fn(() => firebase.auth_mock)
firebase.auth.RecaptchaVerifier = RecaptchaVerifier
firebase.user = null
