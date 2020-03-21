// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
const Large = (superclass) => class extends superclass {
  async directory () {
    const user = firebase.auth().currentUser
    const storage = firebase.storage().ref()
    if (user && navigator.onLine) {
      const path = `/people/${user.phoneNumber}/${this.type}`
      return storage.child(path).listAll()
    }
  }
}
export default Large
