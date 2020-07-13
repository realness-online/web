<template lang="html">
  <section id="sign-on" class="page">
    <header>
      <profile-as-figure :person="person" />
      <logo-as-link />
    </header>
    <profile-as-form :person="person"
                     @modified="save_me"
                     @signed-on="signed_on" />
  </section>
</template>
<script>
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
        person: {
          id: '/+'
        }
      }
    },
    methods: {
      async signed_on (event) {
        const me = new Me()
        await this.$nextTick()
        await me.save()
        this.$router.push({ path: '/' })
      },
      async save_me (event) {
        console.log('save me called')
        const me = new Me()
        await this.$nextTick()
        await me.save()
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
      padding: base-line
</style>
