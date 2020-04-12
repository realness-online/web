import * as firebase from 'firebase/app'
function auth() {
  return {
    currentUser: { phoneNumber: '+16282281824' },
    onAuthStateChanged: jest.fn(state_changed => state_changed()),
  }
}
firebase.auth = auth
firebase.auth.RecaptchaVerifier = class {
  constructor() {
    // console.log('RecaptchaVerifier')
  }
  verify() {
    // console.log('RecaptchaVerifier.verify');
  }
}
