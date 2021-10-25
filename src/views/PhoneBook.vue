<template>
  <section id="directory" class="page">
    <header>
      <router-link v-if="signed_in" to="/relations">
        <icon name="heart" />
      </router-link>
      <icon v-else name="nothing" />
      <h1>Recent</h1>
      <logo-as-link />
    </header>
    <icon v-if="working" name="working" />
    <nav v-if="signed_in" class="profile-list">
      <as-figure
        v-for="person in phonebook"
        :key="person.id"
        v-model:relations="relations"
        :person="person" />
    </nav>
    <p v-if="!working && !signed_in" class="sign-on message"><sign-on /> Check out who's here</p>
  </section>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/storage'
  import { list, load } from '@/helpers/itemid'
  import { from_e64 } from '@/helpers/profile'
  import { is_fresh } from '@/helpers/date'
  import { recent_visit_first } from '@/helpers/sorting'
  import signed_in from '@/mixins/signed_in'
  import logo_as_link from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import as_figure from '@/components/profile/as-figure'
  import sign_on from '@/components/profile/sign-on'
  export default {
    components: {
      icon,
      'as-figure': as_figure,
      'logo-as-link': logo_as_link,
      'sign-on': sign_on
    },
    mixins: [signed_in],
    data() {
      return {
        phonebook: [],
        relations: [],
        working: true
      }
    },
    async created() {
      console.info('views:PhoneBook')
      firebase.auth().onAuthStateChanged(async user => {
        this.relations = await list(`${localStorage.me}/relations`)
        if (user) {
          const phone_numbers = await firebase.storage().ref().child('/people/').listAll()
          await Promise.all(
            phone_numbers.prefixes.map(async phone_number => {
              const person = await load(from_e64(phone_number.name))
              if (person && is_fresh(person.visited)) this.phonebook.push(person)
            })
          )
        }
        this.phonebook.sort(recent_visit_first)
        this.working = false
      })
    }
  }
</script>
<style lang="stylus">
  section#directory
    padding-bottom: base-line * 2
    nav.profile-list
      margin-top: base-line
      & address > h3
        max-width: base-line * 6
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
    svg.working
      margin-top: base-line
      @media (prefers-color-scheme: dark)
        fill: blue
    svg.heart
        fill: blue
</style>
