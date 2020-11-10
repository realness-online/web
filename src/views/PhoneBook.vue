<template>
  <section id="directory" class="page">
    <header>
      <icon name="nothing" />
      <router-link to="/relations">
        <icon name="finished" />
      </router-link>
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
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
  import { list, load } from '@/helpers/itemid'
  import { from_e64 } from '@/helpers/profile'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import as_figure from '@/components/profile/as-figure'
  export default {
    components: {
      'as-figure': as_figure,
      icon
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
      this.relations = await list(`${localStorage.me}/relations`)
      console.info('Views Phonebook')
      const phone_numbers = await firebase.storage().ref().child('/people/').listAll()
      phone_numbers.prefixes.forEach(async (phone_number) => {
        const person = await load(from_e64(phone_number.name))
        if (person) this.phonebook.push(person)
      })
      this.working = false
    }
  }
</script>
<style lang='stylus'>
  section#directory
    svg.working
      fill: blue
      margin-top: base-line
    svg.finished
      fill: blue
    & > hgroup h1
      color: blue
</style>
