import firebase from 'firebase'
class Person {
  constructor() {
    this.config = {
      apiKey: 'AIzaSyDpRbQe67nfP2HTxkThxhY2Fk-ru0x2aus',
      authDomain: 'littleman-8f289.firebaseapp.com',
      databaseURL: 'https://littleman-8f289.firebaseio.com',
      storageBucket: 'littleman-8f289.appspot.com',
      messagingSenderId: '363642054727'
    }
    firebase.initializeApp(this.config)
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
