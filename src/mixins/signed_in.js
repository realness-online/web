import firebase from 'firebase/app'
import 'firebase/auth'
export default {
  data() {
    return {
      signed_in: false
    }
  },
  created() {
    firebase.auth().onAuthStateChanged(user => {
      if (user) this.signed_in = true
      else this.signed_in = false
    })
  }
}
