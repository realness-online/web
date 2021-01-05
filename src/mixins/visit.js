import firebase from 'firebase/app'
import 'firebase/auth'
import { load } from '@/helpers/itemid'
import { from_e64 } from '@/helpers/profile'
import { is_fresh } from '@/helpers/date'
export default {
  created () {
    firebase.auth().onAuthStateChanged(this.update_visit)
  },
  methods: {
    async update_visit (user) {
      if (navigator.onLine && user) {
        const person = await load(from_e64(user.phoneNumber))
        if (person && !is_fresh(person.visited)) {
          person.visited = new Date().toISOString()
          this.$emit('update:person', person)
        }
      }
    }
  }
}
