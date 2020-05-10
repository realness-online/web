<template lang="html">
  <section id="admin" class="page">
    <header>
      <icon name="nothing"></icon>
      <h1>Admin</h1>
      <logo-as-link></logo-as-link>
    </header>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
  import logo_as_link from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import itemid from '@/helpers/itemid'
  import profile from '@/helpers/profile'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      icon
    },
    data () {
      return {
        phonebook: []
      }
    },
    async created () {
      console.info('Views Admin')
      const phone_numbers = await firebase.storage().ref().child('/people/').listAll()
      phone_numbers.prefixes.forEach(async (phone_number) => {
        const person = await itemid.load(profile.from_e64(phone_number.name))
        if (person) this.phonebook.push(person)
      })
    }
  }
</script>
<style lang="stylus">

</style>
