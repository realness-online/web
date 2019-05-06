<template>
  <section id="directory" class="page">
    <header>
      <a></a>
      <h1>Phonebook</h1>
      <router-link to="/relations">
        <icon name="finished"></icon>
      </router-link>
    </header>
    <profile-as-list :people='phonebook'></profile-as-list>
    <profile-as-links id="phonebook" :people='phonebook'></profile-as-links>
    <profile-as-links itemprop="relations" :people='relations'></profile-as-links>
  </section>
</template>
<script>
  import Vue from 'vue'
  import icon from '@/components/icon'
  import { relations_storage } from '@/modules/Storage'
  import profile_id from '@/modules/profile_id'
  import { phonebook_storage } from '@/modules/PhoneBook'
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
        phonebook: []
      }
    },
    created() {
      phonebook_storage.sync_list().then((people) => {
        this.working = false
        this.phonebook = people
        this.phonebook.forEach((person, index) => {
          profile_id.load(person.id).then(profile => {
            if (profile) {
              this.phonebook.splice(index, 1, profile)
            }
          })
        })
      })
    },
    watch: {
      phonebook() {
        if (localStorage.getItem('save-phonebook')) {
          Vue.nextTick(() => phonebook_storage.save())
        }
      },
      relations() {
        Vue.nextTick(() => relations_storage.save())
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
        fill:blue
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
