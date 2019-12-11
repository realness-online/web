<template>
  <section id="directory" class="page">
    <header>
      <icon name="nothing"></icon>
      <router-link to="/relations">
        <icon name="finished"></icon>
      </router-link>
    </header>
    <hgroup>
      <h1>Phonebook</h1>
      <icon v-if="working" name="working"></icon>
    </hgroup>
    <profile-as-list :people='phonebook'></profile-as-list>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
  import { relations_storage } from '@/storage/Storage'
  import signed_in from '@/mixins/signed_in'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  import profile_as_list from '@/components/profile/as-list'
  export default {
    mixins: [signed_in],
    components: {
      'profile-as-list': profile_as_list,
      icon
    },
    data() {
      return {
        phonebook: [],
        working: true
      }
    },
    async created() {
      const phone_numbers = await firebase.storage().ref().child('/people/').listAll()
      phone_numbers.prefixes.forEach(async(phone_number) => {
        const person = await profile.load(profile.from_e64(phone_number.name))
        if (person) {
          this.phonebook.push(person)
        }
      })
      this.working = false
    },
    watch: {
      async relations() {
        await this.$nextTick()
        relations_storage.save()
      }
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
      @media (min-width: mid-screen)
        max-width: page-width
      margin: auto
      &:focus-within > h1
        transition-property: all
        overflow: hidden
        width:0
      & > h1
        color:blue
        vertical-align: top
        margin: 0
        line-height: 1.33
        @media (min-width: max-screen)
          line-height: .66
      & > a > svg.finished
        fill: blue
    nav.profile-list
      display: flex
      flex-direction: column-reverse
      @media (min-width: min-screen)
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
