<template>
  <section id="phonebook" class="page">
    <header>
      <label for="search">
        <input id="search" type="search" placeholder="Search" autocomplete="off"
          v-model="query"
          v-on:focusout="view_friends_mode"
          v-on:focusin="search_mode">
        <icon name="search"></icon>
      </label>
      <h1>Phonebook</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-list itemprop="relations" :people='relations'></profile-as-list>
    <footer>
      <menu>
        <router-link to="/relations">Done</router-link>
      </menu>
    </footer>
  </section>
</template>
<script>
  import Vue from 'vue'
  import logo_as_link from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import profile_as_list from '@/components/profile/as-list'
  import {relations} from '@/modules/Storage'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      'profile-as-list': profile_as_list,
      icon
    },
    data() {
      return {
        relations: relations.as_list(),
        searching: false,
        query: ''
      }
    },
    created: function() {
      localStorage.setItem('relations-count', this.relations.length)
    },
    methods: {
      search_mode(event) {
        this.searching = true
        // search focused
      },
      view_friends_mode(event) {
        this.query = ''
        this.searching = false
      }
    },
    watch: {
      relations() {
        Vue.nextTick(() => {
          relations.save()
        })
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#phonebook
    position: relative
    min-height: 100vh
    & > header
      &:focus-within > h1
        transition-property: all
        overflow: hidden
        width:0
      & > h1
        vertical-align: top
        margin: 0
        line-height: 1.66
        @media (min-width: max-screen)
          line-height: .66
      & > a
        outline: none
    & > footer
      color:red
      position: fixed
      bottom: base-line
      right: base-line
  label[for=search]
    position: relative
    & > *
      height: (2 * base-line)
      width: (2 * base-line)
      vertical-align: middle
    svg
      position: absolute
      top: 0
      left: 0
      z-index: -2
      outline:none
    input#search
      border-width: 0
      border-radius: (base-line / 2)
      position: relative
      z-index: 2
      transition-delay: 0.15s
      transition-property: all
      &::placeholder
        color: transparent
      &:focus
        transition-delay: 0.15s
        border: 0.33vmin solid black
        padding: (base-line / 2 )
        width: inherit
        &::placeholder
          color:red
          transition-duration: 0.75
          transition-property: all
          transition-delay: 0.25s
      &:focus ~ svg
        transition-property: all
        height:0
        width:0
</style>
