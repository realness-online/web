<template>
  <section id="relations" class="page">
    <header >
      <label for="search">
        <input id="search" type="search" placeholder="search">
        <svg><use xlink:href="/static/icons.svg#search"/></svg>
      </label>
      <h2>Relations</h2>
      <logo-as-link></logo-as-link>
    </header>
    <div>

    </div>
  </section>
</template>
<script>
  import logo_as_link from '@/components/logo-as-link'
  export default {
    components: {
      'logo-as-link': logo_as_link
    },
    data() {
      return {}
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#relations
    position: relative
    & > header > h2
      // vertical-align: top;
      // line-height: 1.66
      margin: 0
  label[for=search]
    svg
      position: relative
      z-index: -2
      outline:none
      padding:0
      // margin-left: (base-line /2 )
      vertical-align: middle
      height: (2 * base-line)
      width: (2 * base-line)
  input#search
    border-width: 0
    border-radius: base-line
    position: relative
    z-index: 2
    padding: 0
    width: 0
    padding-right:0
    &:focus
      border: 2px solid black
      padding: (base-line / 2 )
      width: inherit
    &:focus ~ svg
      display: none

</style>
