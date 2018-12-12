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
  import {relations_storage} from '@/modules/Storage'
  import profile from '@/modules/Profile'
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
        relations: relations_storage.as_list(),
        phonebook: [],
        working: true
      }
    },
    created() {
      phonebook_storage.sync_list().then((people) => {
        this.working = false
        this.phonebook = people
        this.phonebook.forEach((person, index) => {
          profile.load(person.id).then(profile => {
            this.phonebook.splice(index, 1, profile)
          })
        })
      })
      this.$bus.$off('remove-relationship')
      this.$bus.$off('add-relationship')
      this.$bus.$on('add-relationship', person => {
        this.relations.push(person)
        localStorage.setItem('relations-count', this.relations.length)
      })
      this.$bus.$on('remove-relationship', person => {
        const index = this.relations.findIndex(p => (p.id === person.id))
        if (index > -1) {
          this.relations.splice(index, 1)
          localStorage.setItem('relations-count', this.relations.length)
        }
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
