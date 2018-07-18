<template>
  <section id="relations" class="page">
    <header>
      <router-link to="/phonebook"><icon name="heart"></icon></router-link>
      <h1>Relations</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-list itemprop="relations" :people='relations'></profile-as-list>
  </section>
</template>
<script>
  import Vue from 'vue'
  import logo_as_link from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import profile_as_list from '@/components/profile/as-list'
  import {relations_storage} from '@/modules/Storage'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      'profile-as-list': profile_as_list,
      icon
    },
    data() {
      return {
        relations: relations_storage.as_list(),
        searching: false,
        query: ''
      }
    },
    created() {
      localStorage.setItem('relations-count', this.relations.length)
    },
    watch: {
      relations() {
        Vue.nextTick(() => {
          relations_storage.save()
        })
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
        color:blue
        vertical-align: top
        margin: 0
        line-height: 1.33
        @media (min-width: max-screen)
          line-height: .66
      & > a
        outline: none
    svg.heart
      fill:blue
      height: (2 * base-line)
      width: (2 * base-line)
      vertical-align: middle

      outline:none

</style>
