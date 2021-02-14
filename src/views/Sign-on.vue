<template lang="html">
  <section id="sign-on" class="page">
    <header>
      <profile-as-figure v-if="person" :person="person">
        <p /> <!-- defeat the default slot -->
      </profile-as-figure>
      <logo-as-link />
    </header>
    <mobile-as-form v-if="person && !nameless" :person.sync="person" @signed-on="signed_on" />
    <name-as-form v-if="nameless" :person.sync="person" @valid="new_person" />
    <footer>
      <button v-if="cleanable" @click="clean">Wipe</button>
    </footer>
  </section>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/auth'
  import { keys, clear } from 'idb-keyval'
  import { load } from '@/helpers/itemid'
  import { Me } from '@/persistance/Storage'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_figure from '@/components/profile/as-figure'
  import mobile_as_form from '@/components/profile/as-form-mobile'
  import name_as_form from '@/components/profile/as-form-name'
  import signed_on from '@/mixins/signed_in'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      'profile-as-figure': profile_as_figure,
      'mobile-as-form': mobile_as_form,
      'name-as-form': name_as_form
    },
    mixins: [signed_on],
    data () {
      return {
        nameless: false,
        index_db_keys: [],
        person: null
      }
    },
    computed: {
      cleanable () {
        if (this.signed_in) return false
        if (localStorage.me.length > 2) return true
        if (localStorage.length > 2) return true
        if (this.index_db_keys.length > 0) return true
        else return false
      }
    },
    async created () {
      const person = await load(localStorage.me)
      const new_person = {
        id: '/+',
        mobile: null
      }
      if (person) this.person = person
      else this.person = new_person
      this.index_db_keys = await keys()
      firebase.auth().onAuthStateChanged(this.auth_state)
    },
    methods: {
      auth_state (user) {
        if (user) this.person.mobile = null
      },
      async signed_on () {
        const my_profile = await load(localStorage.me)
        if (my_profile) this.$router.push({ path: '/' })
        else this.nameless = true
      },
      async new_person () {
        this.person.visited = new Date().toISOString()
        this.person.id = localStorage.me
        await this.$nextTick()
        const me = new Me()
        await me.save()
        await this.$nextTick()
        this.$router.push({ path: '/account' })
      },
      async clean () {
        localStorage.clear()
        localStorage.me = '/+'
        await clear()
        this.$router.push({ path: '/' })
      }
    }
  }
</script>
<style lang="stylus">
  section#sign-on.page
    display: flex
    flex-direction: column
    justify-content: space-between
    hgroup
      color: red
    figure.profile
      align-items: center
      & > svg
        border-radius: base-line * 2
        width: base-line * 2
        height: base-line * 2
        border-color: red
      & > figcaption
        padding: 0 0 0 round((base-line / 4 ), 2)
    svg.background
      fill: red
    form
    footer
      padding: base-line
      padding-top: 0
    & > footer > button
      opacity: 0.5
      &:hover
        opacity: 1
    @media (min-width: pad-begins)
      form
        align-self: center
</style>
