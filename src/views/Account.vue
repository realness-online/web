<template lang="html">
  <section id="account" :class="{'signed-in': signed_in}" class="page">
    <header>
      <icon name="nothing"/>
      <logo-as-link/>
    </header>
    <avatar-as-form :person="me" @new-avatar="new_avatar"/>
    <div id="login">
      <profile-as-figure :person="me"/>
      <profile-as-form :person="me" @modified="save_me"/>
    </div>
    <as-days itemscope :itemid="itemid" :statements="statements">
      <thought-as-article :post="item"
                          @viewed="statement_viewed"
                          @modified="save_page"/>
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
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import avatar_as_form from '@/components/avatars/as-form'
  import thought_as_article from '@/components/statements/as-article'
  export default {
    components: {
      icon,
      'logo-as-link': logo_as_link,
      'profile-as-figure': profile_as_figure,
      'profile-as-form': profile_as_form,
      'thought-as-article': thought_as_article,
      'avatar-as-form': avatar_as_form
    },
    mixins: [signed_in],
    data () {
      return {
        statements: [],
        image_file: null
      }
    },
    async created () {
      console.info('Views account page')
      if (this.signed_in) {
        localStorage.setItem('me', profile.from_e64(firebase.auth().currentUser.phoneNumber))
      }
      this.statements = itemid.list(`${this.me}/statements`)
    },
    methods: {
      async new_avatar (avatar_url) {
        const me = new Me()
        me.avatar = avatar_url
        await this.$nextTick()
        me.save()
      },
      async save_me (event) {
        if (this.signed_in) {
          localStorage.setItem('me', profile.from_e64(firebase.auth().currentUser.phoneNumber))
        }
        await this.$nextTick()
        new Me().save()
      },
      async save_page (event) {
        await this.$nextTick()
        await new Statements().save()
      }
    }
  }
</script>
<style lang='stylus'>
  section#account
    svg.background
      fill: red
    & > header
      position: absolute
      width:100%
      z-index: 2
    & > div#login
      margin: auto
      max-width: page-width
      padding: base-line
      form
        margin-top: base-line
    & > div#pages-of-statements
      max-width: page-width
      margin: auto
      padding: base-line base-line 0 base-line
      & > div[itemprop]
        display:flex
        flex-direction: column-reverse
        & > section.day
          display:flex
          flex-direction: column
          &.today
            flex-direction: column-reverse
            & > header
              order: 1
          & > header > h4
            margin-top: base-line
</style>
