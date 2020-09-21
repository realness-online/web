<template lang="html">
  <section id="sign-on" class="page">
    <header>
      <profile-as-figure :person="person" />
      <logo-as-link />
    </header>
    <name-as-form v-if="nameless"
                  :person="person"
                  @validated="new_person" />
    <mobile-as-form v-else :person="person"
                    @signed-on="signed_on" />
    <footer>
      <button v-if="cleanable" @click="clean">Wipe</button>
    </footer>
  </section>
</template>
<script>
  import { keys, clear } from 'idb-keyval'
  import { load } from '@/helpers/itemid'
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
        index_db_keys: {},
        person: {
          id: '/+',
          mobile: null
        }
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
      this.index_db_keys = await keys()
      const person = await load(localStorage.me)
      if (person) this.person = person
    },
    methods: {
      async signed_on (event) {
        const my_profile = await load(localStorage.me)
        if (my_profile) this.$router.push({ path: '/' })
        else this.nameless = true
      },
      async new_person () {
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
    figure.profile > svg
      border-color: red
    svg.background
      fill: red
    form
    footer
      padding: base-line
    & > footer > button
      opacity: 0.5
      &:hover
        opacity: 1
    @media (min-width: pad-begins)
      form
        align-self: center
</style>
