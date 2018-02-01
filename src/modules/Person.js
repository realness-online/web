import firebase from 'firebase'
class Person {
  constructor() {
    this.storage_ref = firebase.storage().ref()
    this.auth = firebase.auth()
  }

  authorize() {
    this.auth.onAuthStateChanged(user => {
      if (user) {
        const url = `users/${this.auth.currentUser.uid}/profile.html`
        console.log('User is signed in.', url)
      } else {
        // User is signed out.
        this.auth.signInAnonymously()
      }
    })
  }
}
export default Person
