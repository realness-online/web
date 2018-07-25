<template>
  <section id="directory" class="page">
    <header>
      <profile-search></profile-search>
      <h1>Phonebook</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-list id="phonebook" :people='phonebook'></profile-as-list>
    <footer>
      <menu>
        <router-link to="/relations">Done</router-link>
      </menu>
    </footer>
    <aside>
      <profile-as-list itemprop="relations" :people='relations'></profile-as-list>
    </aside>
  </section>
</template>
<script>
  import Vue from 'vue'
  import profile_as_search from '@/components/profile/as-search'
  import {phonebook_storage} from '@/modules/PhoneBook'
  import relationship_mixin from '@/pages/relationship-mixin'
  export default {
    mixins: [relationship_mixin],
    components: {
      'profile-search': profile_as_search
    },
    created() {
      phonebook_storage.sync_list().then(people => (this.phonebook = people))
    },
    data() {
      return {
        phonebook: []
      }
    },
    watch: {
      phonebook() {
        Vue.nextTick(() => {
          if (localStorage.getItem('save-phonebook')) {
            phonebook_storage.save()
          }
        })
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#directory
    animation-name: slideInLeft
    position: relative
    min-height: 100vh
    & > header
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
    & > footer
      position: fixed
      bottom: (base-line * 1.5)
      right: base-line
      & menu > a
        standard-button: red
    & > aside
      display: none
</style>
