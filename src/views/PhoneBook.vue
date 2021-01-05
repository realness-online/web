<template>
  <section id="directory" class="page">
    <header>
      <router-link v-if="signed_in" to="/relations">
        <icon name="heart" />
      </router-link>
      <icon v-else name="nothing" />
      <logo-as-link />
    </header>
    <hgroup>
      <h1>Phonebook</h1>
      <icon v-if="working" name="working" />
    </hgroup>
    <nav v-if="signed_in" class="profile-list">
      <as-figure v-for="person in phonebook"
                 :key="person.id"
                 :person="person"
                 :relations.sync="relations" />
    </nav>
    <hgroup v-else class="sign-on message">
      <p> <sign-on /> and you can check out who's on here </p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/storage'
  import { list, load } from '@/helpers/itemid'
  import logo_as_link from '@/components/logo-as-link'
  import { from_e64 } from '@/helpers/profile'
  import signed_in from '@/mixins/signed_in'
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
    data () {
      return {
        phonebook: [],
        relations: [],
        working: true
      }
    },
    async created () {
      console.info('views:Phonebook')
      this.relations = await list(`${localStorage.me}/relations`)
      if (this.signed_in) {
        const phone_numbers = await firebase.storage().ref().child('/people/').listAll()
        phone_numbers.prefixes.forEach(async (phone_number) => {
          const person = await load(from_e64(phone_number.name))
          if (person) this.phonebook.push(person)
        })
      }
      this.working = false
    }
  }
</script>
<style lang='stylus'>
  section#directory
    svg.working
      fill: blue
      margin-top: base-line
    svg.heart
      fill: blue
    & > hgroup h1
      color: blue
</style>
