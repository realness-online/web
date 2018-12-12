<template>
  <section id="relations" class="page">
    <header>
      <router-link to="/phonebook"><icon name="heart"></icon></router-link>
      <h1>Relations</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-list :people='relations'></profile-as-list>
    <profile-as-links itemprop="relations" :people='relations'></profile-as-links>
  </section>
</template>
<script>
  import logoAsLink from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import profileAsList from '@/components/profile/as-list'
  import profileAsLinks from '@/components/profile/as-links'
  import Vue from 'vue'
  import {relations_storage} from '@/modules/Storage'
  import phone_number from '@/modules/phone_number'
  export default {
    components: {
      icon,
      profileAsList,
      profileAsLinks,
      logoAsLink
    },
    data() {
      return {
        relations: relations_storage.as_list()
      }
    },
    created() {
      this.relations.forEach((relation, index) => {
        phone_number.profile(relation.id).then(profile => {
          this.relations.splice(index, 1, profile)
        })
      })
      this.$bus.$off('remove-relationship')
      this.$bus.$off('add-relationship')
      this.$bus.$on('add-relationship', person => {
        console.log('add-relationship', person)
        this.relations.push(person)
        localStorage.setItem('relations-count', this.relations.length)
        Vue.nextTick(() => relations_storage.save())
      })
      this.$bus.$on('remove-relationship', person => {
        console.log('remove-relationship', person)
        const index = this.relations.findIndex(p => (p.id === person.id))
        if (index > -1) {
          this.relations.splice(index, 1)
          localStorage.setItem('relations-count', this.relations.length)
          Vue.nextTick(() => relations_storage.save())
        }
      })
    },
    watch: {
      relations() {
        console.log('relations watch')
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#relations svg.heart
    fill: blue
</style>
