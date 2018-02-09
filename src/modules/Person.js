import firebase from 'firebase'
export const auth = firebase.auth()
export const person = auth.currentUser
export default person
