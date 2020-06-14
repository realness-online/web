<template lang="html">
  <section id="account" :class="{'signed-in': signed_in}" class="page">
    <header>
      <icon v-if="signed_in" name="nothing" />
      <sign-on v-else />
      <logo-as-link />
    </header>
    <avatar-as-form v-if="signed_in" :person="person" @new-avatar="new_avatar" />
    <div v-if="show_form" id="login">
      <profile-as-figure v-if="signed_in" :person="person" />
      <profile-as-form :person="person" @modified="save_me" />
    </div>
    <h1>Statements</h1>
    <as-days v-slot="thoughts" itemscope
             :itemid="itemid" :statements="statements">
      <thought-as-article v-for="thought in thoughts"
                          :key="thought[0].id"
                          :statements="thought"
                          :verbose="false" />
    </as-days>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile from '@/helpers/profile'
  import itemid from '@/helpers/itemid'
  import { Statements, Me } from '@/persistance/Storage'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import as_days from '@/components/as-days'
  import logo_as_link from '@/components/logo-as-link'
  import sign_on from '@/components/sign-on'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import avatar_as_form from '@/components/avatars/as-form'
  import thought_as_article from '@/components/statements/as-article'
  export default {
    components: {
      icon,
      'as-days': as_days,
      'sign-on': sign_on,
      'logo-as-link': logo_as_link,
      'profile-as-figure': profile_as_figure,
      'profile-as-form': profile_as_form,
      'thought-as-article': thought_as_article,
      'avatar-as-form': avatar_as_form
    },
    mixins: [signed_in],
    data () {
      return {
        person: {},
        statements: [],
        image_file: null,
        me_storage: null,
        statements_storage: null,
        show_form: false
      }
    },
    computed: {
      itemid () { return `${this.me}/statements` }
    },
    watch: {
      signed_in () {
        if (this.signed_in) {
          localStorage.setItem('me', profile.from_e64(firebase.auth().currentUser.phoneNumber))
        }
      }
    },
    async created () {
      console.info('Views account page')
      this.me_storage = new Me()
      this.statements_storage = new Statements()
      this.person = await itemid.load(this.me)
      const statements = await itemid.list(`${this.me}/statements`)
      if (Array.isArray(statements)) this.statements = statements
      else if (statements) this.statements = [statements]
    },
    methods: {
      async new_avatar (avatar_url) {
        this.person.avatar = avatar_url
        await this.$nextTick()
        this.me_storage.save()
      },
      async save_me (event) {
        await this.$nextTick()
        await this.me_storage.save()
      },
      async save_page (event) {
        await this.$nextTick()
        await this.statements_storage.save()
      }
    }
  }
</script>
<style lang='stylus'>
  section#account
    svg.background
      fill: red
    & > *:not(header)
      padding: base-line
    & div#login > figure
      margin-bottom: base-line
    article.day
      @media (min-width: pad-begins)
        grid-auto-rows: auto
      @media (min-width: typing-begins)
        grid-auto-rows: auto
</style>
