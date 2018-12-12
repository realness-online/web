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
    <profile-as-links id="phonebook" :people='phonebook_links'></profile-as-links>
    <profile-as-links itemprop="relations" :people='relation_links'></profile-as-links>
  </section>
</template>
<script>
  import Vue from 'vue'
  import icon from '@/components/icon'
  import {relations_storage} from '@/modules/Storage'
  import phone_number from '@/modules/phone_number'
  import {phonebook_storage} from '@/modules/PhoneBook'
  import profileAsList from '@/components/profile/as-list'
  import profileAsLinks from '@/components/profile/as-links'
  export default {
    components: {
      profileAsList,
      profileAsLinks,
      icon
    },
    data() {
      return {
        relation_links: relations_storage.as_list(),
        phonebook_links: [],
        phonebook: [],
        working: true
      }
    },
    created() {
      phonebook_storage.sync_list().then((people) => {
        this.working = false
        this.phonebook_links = people
        people.forEach(phone => {
          phone_number.profile(phone.id).then(item => {
            this.phonebook.push(item)
          })
        })
      })
      this.$bus.$off('remove-relationship')
      this.$bus.$off('add-relationship')
      this.$bus.$on('add-relationship', person => {
        // console.log('add-relationship', person)
        this.relation_links.push(person)
        localStorage.setItem('relations-count', this.relation_links.length)
      })
      this.$bus.$on('remove-relationship', person => {
        // console.log('remove-relationship', person)
        const index = this.relation_links.findIndex(p => (p.id === person.id))
        if (index > -1) {
          this.relation_links.splice(index, 1)
          localStorage.setItem('relations-count', this.relation_links.length)
        }
      })
    },
    watch: {
      phonebook() {
        Vue.nextTick(() => {
          if (localStorage.getItem('save-phonebook')) {
            phonebook_storage.save()
          }
        })
      },
      relation_links() {
        Vue.nextTick(() => relations_storage.save())
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
