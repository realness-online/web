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
      const profile_id = `/${phone_number}`
      console.log(profile_id)
      profile.load(profile_id).then(profile => {
        this.person = profile
      })
      profile.items(profile_id, 'posts').then(items => {
        this.posts = items
        this.working = false
      })
    } else {
      this.person = person_storage.as_object()
      this.me = true
      this.working = false
    }
  }
}
