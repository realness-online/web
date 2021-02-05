import firebase from 'firebase/app'
import 'firebase/auth'
import { load } from '@/helpers/itemid'
import { from_e64 } from '@/helpers/profile'
import { visit_interval } from '@/workers/sync'
export default {
  created () { this.update_visit() },
  methods: {
    update_visit () {
      firebase.auth().onAuthStateChanged(async user => {
        if (navigator.onLine && user) {
          const person = await load(from_e64(user.phoneNumber))
          if (!person) return // Do nothing until there is a person
          const visit_digit = new Date(person.visited).getTime()
          if (visit_interval() > visit_digit) {
            const new_visit = new Date().toISOString()
            person.visited = new_visit
            this.$emit('update:person', person)
          }
        }
      })
    }
  }
}
