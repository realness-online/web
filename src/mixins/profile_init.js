import {person_storage} from '@/modules/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import profile from '@/modules/Profile'
export default {
  data() {
    return {
      person: {},
      working: true,
      me: false
    }
  },
  created() {
    const phone_number = this.$route.params.phone_number
    if (phone_number) {
      firebase.auth().onAuthStateChanged(user => {
        if (user && user.phoneNumber === phone_number) {
          this.me = true
        }
      })
      profile.load(`/${phone_number}`).then(profile => {
        this.person = profile
        this.working = false
      })
    } else {
      this.me = true
      if (sessionStorage.getItem('profile_synced')) {
        this.person = person_storage.as_object()
        this.working = false
      } else {
        this.person = person_storage.as_object()
        profile.load(this.person.id).then(profile => {
          this.person = profile
          this.working = false
          sessionStorage.setItem('profile_synced', true)
          console.log('profile_synced', sessionStorage.getItem('profile_synced'))
        })
      }
    }
  }
}
