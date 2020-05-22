<template>
  <section id="directory" class="page">
    <header>
      <icon name="nothing"/>
      <router-link to="/relations">
        <icon name="finished"/>
      </router-link>
    </header>
    <hgroup>
      <h1>Phonebook</h1>
      <icon v-if="working" name="working"/>
    </hgroup>
    <profile-as-list :people="phonebook"/>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
  import { Relations } from '@/persistance/Storage'
  import itemid from '@/helpers/itemid'
  import profile from '@/helpers/profile'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import profile_as_list from '@/components/profile/as-list'
  export default {
    components: {
      'profile-as-list': profile_as_list,
      icon
    },
    mixins: [signed_in],
    data () {
      return {
        phonebook: [],
        working: true
      }
    },
    watch: {
      async relations () {
        console.info('Saves Relations')
        await this.$nextTick()
        new Relations().save()
      }
    },
    async created () {
      console.info('Views Phonebook')
      const phone_numbers = await firebase.storage().ref().child('/people/').listAll()
      phone_numbers.prefixes.forEach(async (phone_number) => {
        const person = await itemid.load(profile.from_e64(phone_number.name))
        if (person) this.phonebook.push(person)
      })
      this.working = false
    }
  }
</script>
<style lang='stylus'>
  section#directory
    position: relative
    min-height: 100vh
    svg.working
      fill: blue
      margin-top: base-line
    & > header
      @media (min-width: typing-begins)
        max-width: page-width
      margin: auto
      &:focus-within > h1
        transition-property: all
        overflow: hidden
        width:0
      & > a > svg.finished
        fill: blue
    & > hgroup h1
      color: blue
    nav.profile-list
      display: flex
      flex-direction: column-reverse
      @media (min-width: pad-begins)
        flex-direction: row
    & > footer
      position: fixed
      bottom: (base-line * 1.5)
      right: base-line
      & menu > a
        standard-button: red
    & > aside
      display: none
</style>
