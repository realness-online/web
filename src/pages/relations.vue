<template>
  <section id="relations" class="page" >
    <header >
      <label for="search">
        <input id="search" type="search" placeholder="Search"
          v-model="query"
          v-on:focusout="view_friends_mode"
          v-on:focusin="search_mode">
        <icon id="search"></icon>
      </label>
      <h1>Relations</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-index itemprop="relations" :people='relations'></profile-as-index>
    <profile-as-index id="phonebook" :people='phonebook'></profile-as-index>
  </section>
</template>
<script>
  import logo_as_link from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import as_index from '@/components/profile/as-index'
  import {relations, phonebook} from '@/modules/Storage'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      'profile-as-index': as_index,
      icon
    },
    data() {
      return {
        relations: relations.as_list(),
        phonebook: phonebook.as_list(),
        query: ''
      }
    },
    methods: {
      search_mode(event) {
        // search focused
      },
      view_friends_mode(event) {
        this.query = ''
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#relations
    position: relative
    & > header
      &:focus-within > h1
        transition-property: all
        overflow: hidden
        width:0
      & > h1
        vertical-align: top
        margin: 0
        line-height: 1.33
        @media (min-width: max-screen)
          line-height: .66
      & > a
        outline: none
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
