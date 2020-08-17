<template lang="html">
  <section id="sign-on" class="page">
    <header>
      <profile-as-figure :person="person" />
      <logo-as-link />
    </header>
    <profile-as-form :person="person"
                     @modified="save_me"
                     @signed-on="signed_on" />
    <footer v-if="cleanable">
      <button @click="clean">Clean</button>
    </footer>
  </section>
</template>
<script>
  import { keys, clear } from 'idb-keyval'
  import { load } from '@/helpers/itemid'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import { Me } from '@/persistance/Storage'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      'profile-as-figure': profile_as_figure,
      'profile-as-form': profile_as_form
    },
    data () {
      return {
        index_db_keys: {},
        person: {
          id: '/+',
          mobile: null
        }
      }
    },
    computed: {
      cleanable () {
        if (this.me.length > 2) return true
        if (localStorage.length > 2) return true
        if (this.index_db_keys.length > 0) return true
        else return false
      }
    },
    async created () {
      this.index_db_keys = await keys()
      const person = await load(this.me)
      console.log(person, this.me, this.index_db_keys.length)
      if (person) this.person = person
    },
    methods: {
      async signed_on (event) {
        const me = new Me()
        await this.$nextTick()
        await me.save()
        this.$router.push({ path: '/' })
      },
      async save_me (event) {
        const me = new Me()
        await this.$nextTick()
        await me.save()
      },
      async clean () {
        localStorage.clear()
        await clear()
        location.reload()
      }
    }
  }
</script>
<style lang="stylus">
  section#sign-on.page
    hgroup
      color: red
    svg.background
      fill: red
    form
    footer
      padding: base-line
    @media (min-width: pad-begins)
      form
        margin: auto
</style>
