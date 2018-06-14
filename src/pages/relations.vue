<template>
  <section id="relations" class="page" >
    <header >
      <label for="search">
        <input id="search" type="search" placeholder="Search"
          v-model="query"
          v-on:focusout="view_friends_mode"
          v-on:focusin="search_mode">
        <svg><use :xlink:href="search"/></svg>
      </label>
      <h1>Relations</h1>
      <logo-as-link></logo-as-link>
    </header>
    <nav itemprop="relations" >
      <li v-for="person in relations">
        <profile-as-figure :person='person'></profile-as-figure>
        <menu>
          <a><svg><use :xlink:href="hamburger"/></svg></a>
        </menu>
      </li>
    </nav>
  </section>
</template>
<script>
  import logo_as_link from '@/components/logo-as-link'
  import as_figure from '@/components/profile/as-figure'
  import icons from '@/icons.svg'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      'profile-as-figure': as_figure
    },
    data() {
      return {
        relations: [{
          first_name: 'scott',
          last_name: 'fryxell',
          mobile: '6282281824'
        },
        {
          first_name: 'katie',
          last_name: 'caffey',
          mobile: '2403800385‬'
        },
        {
          first_name: 'joe',
          last_name: 'buenous',
          mobile: '3154476717'
        },
        {
          first_name: 'scottMcMansionalotMcMansionalot',
          last_name: 'fryxell',
          mobile: '6282281824'
        },
        {
          first_name: 'katie',
          last_name: 'caffey',
          mobile: '2403800385‬'
        },
        {
          first_name: 'Josephelious',
          last_name: 'McMansionalotMcMansionalot',
          mobile: '7073134462'
        },
        {
          first_name: 'joe',
          last_name: 'buenous',
          mobile: '3154476717'
        }
        ],
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
    },
    computed: {
      hamburger() {
        return `${icons}#hamburger`
      },
      search() {
        return `${icons}#search`
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
  nav[itemprop=relations]
    & > li
      margin-top: base-line
      list-style: none
      display: flex
      justify-content: space-between
      & > figure
        & > figcaption a
          color:blue
        & svg
          fill:blue
      & > menu
        display: inline-flex
        align-items: center;
        margin-left:  (base-line / 2)
        svg
          cursor: pointer;
          fill:black
          width: (base-line / 1.66)
          height: (base-line / 1.66)
    @media (min-width: min-screen)
      display: flex
      flex-direction: row
      flex-wrap: wrap
      justify-content: space-between
      & > li
        padding: (base-line / 2)
        border: 0.33vmin solid black
        border-radius: (base-line / 3)
        width:49%
    @media (min-width: max-screen)
      & > li
        width:32%

</style>
