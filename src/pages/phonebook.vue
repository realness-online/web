<template>
  <section id="directory" class="page">
    <header>
      <a></a>
      <h1>Phonebook</h1>
      <router-link to="/relations">
        <icon name="finished"></icon>
      </router-link>
    </header>
    <icon v-show="loading" name="working"></icon>
    <profile-as-list id="phonebook" :people='phonebook'></profile-as-list>
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
  import icon from '@/components/icon'
  export default {
    mixins: [relationship_mixin],
    components: {
      'profile-search': profile_as_search,
      icon
    },
    created() {
      phonebook_storage.sync_list().then((people) => {
        this.phonebook = people
        this.loading = false
      })
    },
    data() {
      return {
        phonebook: [],
        loading: true
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
    position: relative
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
      & > a > svg.finished
        fill:blue
    & > footer
      position: fixed
      bottom: (base-line * 1.5)
      right: base-line
      & menu > a
        standard-button: red
    & > aside
      display: none
</style>
