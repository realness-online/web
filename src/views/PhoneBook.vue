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
    <profile-as-links id="phonebook" :people='phonebook'></profile-as-links>
    <profile-as-links itemprop="relations" :people='relations'></profile-as-links>
  </section>
</template>
<script>
  import { relations_local } from '@/modules/LocalStorage'
  import { phonebook_storage } from '@/modules/PhoneBook'
  import profile_id from '@/modules/profile_id'
  import icon from '@/components/icon'
  import profileAsList from '@/components/profile/as-list'
  import profileAsLinks from '@/components/profile/as-links'
  import relationship_events from '@/mixins/relationship_events'
  export default {
    mixins: [relationship_events],
    components: {
      profileAsList,
      profileAsLinks,
      icon
    },
    data() {
      return {
        phonebook: [],
        working: true
      }
    },
    async created() {
      const people = await phonebook_storage.sync_list()
      this.phonebook = people
      this.working = false
      // console.log(this.phonebook.length);
      this.phonebook.forEach(async(person, index) => {

        const profile = await profile_id.load(person.id)
        if (profile) {
          this.phonebook.splice(index, 1, profile)
        }
      })
    },
    watch: {
      phonebook() {
        if (localStorage.getItem('save-phonebook')) {
          this.$nextTick(() => phonebook_storage.save())
        }
      },
      relations() {
        this.$nextTick(() => relations_local.save())
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
