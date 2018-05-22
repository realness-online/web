<template>
  <section id="relations" class="page">
    <header >
      <label for="search">
        <input id="search" type="search" placeholder="Search"
          v-model="query"
          v-on:focusout="friends_mode"
          v-on:focusin="search_mode">
        <svg><use xlink:href="/static/icons.svg#search"/></svg>
      </label>
      <h1 v-if="!searching">Relations</h1>
      <logo-as-link></logo-as-link>
    </header>
  </section>
</template>
<script>
  import logo_as_link from '@/components/logo-as-link'
  export default {
    components: {
      'logo-as-link': logo_as_link
    },
    data() {
      return {
        searching: false,
        query: ''
      }
    },
    methods: {
      search_mode(event) {
        this.searching = true
        // this.$el.querySelector("#search").setAttribute('placeholder', 'search')
      },
      friends_mode(event) {
        // this.$el.querySelector("#search").setAttribute('placeholder', '')
        this.searching = false
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
      & > h1
        vertical-align: top
        line-height: 1.66
        margin: 0
      & > a
        outline: none
  label[for=search]
    position: relative;
    & > *
      height: (2 * base-line)
      width: (2 * base-line)
      vertical-align: middle
    svg
      position: absolute
      top:0
      left:0
      z-index: -2
      outline:none
    input#search
      position: relative
      border-width: 0
      border-radius: (base-line / 2)
      position: relative
      z-index: 2
      transition-delay: 0.15s
      transition-property: all
      &::placeholder
        color:transparent

      &:focus
        transition-delay: 0.15s
        border: 2px solid black
        padding: (base-line / 2 )
        width: inherit
        &::placeholder
          color:red
          transition-property: all
          transition-delay: 0.15s
      &:focus ~ svg
        transition-property: all
        height:0
        width:0

</style>
