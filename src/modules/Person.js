import firebase from 'firebase'
class Person {
  constructor() {
    this.storage_ref = firebase.storage().ref()
    this.auth = firebase.auth()
  }

 static initializeApp() {
   firebase.initializeApp({
     apiKey: 'AIzaSyDpRbQe67nfP2HTxkThxhY2Fk-ru0x2aus',
     authDomain: 'littleman-8f289.firebaseapp.com',
     databaseURL: 'https://littleman-8f289.firebaseio.com',
     storageBucket: 'littleman-8f289.appspot.com',
     messagingSenderId: '363642054727'
   })
   firebase.auth().onAuthStateChanged(user => {
     if (user) {
       const url = `users/${firebase.auth().currentUser.uid}/profile.html`
       console.log('User is signed in.', user, url)
     } else {
       console.log('User is signed out.')
       firebase.auth().signInAnonymously()
     }
   })
 }

}
export default Person
