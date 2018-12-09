<template>
  <section id="directory" class="page">
    <header>
      <a></a>
      <h1>Phonebook</h1>
      <router-link to="/relations">
        <icon name="finished"></icon>
      </router-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <profile-as-list :people='phonebook'></profile-as-list>
    <profile-as-links id="phonebook" :people='phonebook'></profile-as-links>
    <profile-as-links itemprop="relations" :people='relations'></profile-as-links>
  </section>
</template>
<script>
  import Vue from 'vue'
  import icon from '@/components/icon'
  import profileAsList from '@/components/profile/as-list'
  import profileAsLinks from '@/components/profile/as-links'
  import {phonebook_storage} from '@/modules/PhoneBook'
  import relationship_status from '@/mixins/relationship_status'
  export default {
    mixins: [relationship_status],
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
    created() {
      console.log('get relations')
      phonebook_storage.sync_list().then((people) => {
        this.working = false
        this.phonebook = people
      }).catch(error => {
        console.log(error.message)
      })
    },
    watch: {
      phonebook() {
        Vue.nextTick(() => {
          if (localStorage.getItem('save-phonebook')) {
            // phonebook_storage.save()
            // console.log('phoebook saved to server')
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
    svg.working
      fill: blue
      margin-top: base-line
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
