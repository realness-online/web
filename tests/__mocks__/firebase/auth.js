import * as firebase from 'firebase/app'
firebase.auth_mock = {
  get currentUser () {
    return firebase.user
  },
  onAuthStateChanged: jest.fn(state => state(firebase.user)),
  signInWithPhoneNumber: jest.fn(() => Promise.resolve('success')),
  RecaptchaVerifier: class {
    verify () {
      // console.log('RecaptchaVerifier.verify');
    }
  }
}
firebase.auth = jest.fn(() => firebase.auth_mock)
firebase.user = null
