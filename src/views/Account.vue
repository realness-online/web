<template lang="html">
  <section id="account" :class="{'signed-in': signed_in}" class="page">
    <header>
      <icon v-if="signed_in" name="nothing" />
      <sign-on v-else />
      <logo-as-link />
    </header>
    <div v-if="signed_in">
      <avatar-as-form :person="person" @new-avatar="new_avatar" />
      <profile-as-figure :person="person" />
    </div>
    <h1>Statements</h1>
    <as-days v-if="has_statements"
             v-slot="thoughts"
             itemscope
             :itemid="statements_id"
             :statements="statements">
      <thought-as-article v-for="thought in thoughts"
                          :key="thought[0].id"
                          :statements="thought"
                          :editable="!working" />
    </as-days>
    <hgroup v-else class="message">
      <p>Say some stuff via the <button class="mock" /> button on the homepage</p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import { Statements, Me } from '@/persistance/Storage'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import as_days from '@/components/as-days'
  import logo_as_link from '@/components/logo-as-link'
  import sign_on from '@/components/sign-on'
  import profile_as_figure from '@/components/profile/as-figure'
  import avatar_as_form from '@/components/avatars/as-form'
  import thought_as_article from '@/components/statements/as-article'
  export default {
    components: {
      icon,
      'as-days': as_days,
      'sign-on': sign_on,
      'logo-as-link': logo_as_link,
      'profile-as-figure': profile_as_figure,
      'thought-as-article': thought_as_article,
      'avatar-as-form': avatar_as_form
    },
    mixins: [signed_in],
    data () {
      return {
        person: {},
        statements: [],
        image_file: null,
        working: true
      }
    },
    computed: {
      statements_id () { return `${this.me}/statements` },
      has_statements () { return this.statements.length > 0 }
    },
    async created () {
      console.info('Views account page')
      const [person, statements] = await Promise.all([
        itemid.load(this.me, this.me),
        itemid.list(`${this.me}/statements`, this.me)
      ])
      if (person) this.person = person
      if (Array.isArray(statements)) this.statements = statements
      else if (statements) this.statements = [statements]
      this.working = false
    },
    mounted () {
      const html = document.getElementsByTagName('html')[0]
      html.style.setProperty('--slip-color', '#52A0D1')
    },
    destroyed () {
      const html = document.getElementsByTagName('html')[0]
      html.style.removeProperty('--slip-color')
    },
    methods: {
      async new_avatar (avatar_url) {
        this.working = true
        this.person.avatar = avatar_url
        const me = new Me()
        await this.$nextTick()
        await me.save()
        this.working = false
      },
      async save_me (event) {
        this.working = true
        await this.$nextTick()
        const me = new Me()
        await me.save()
        this.working = false
      },
      async save_statements (event) {
        this.working = true
        await this.$nextTick()
        const statements = new Statements()
        await statements.save()
        this.working = false
      }
    }
  }
</script>
<style lang='stylus'>
  section#account
    button, a
      border-color: red
      color: red
      border-color: red
    button.mock
      background-color: red
      border-radius: 0.2em
      height: 1.33em
    p[itemprop="statement"]:focus
      outline: 2px solid red
    h1
      width:100vw
      margin: 0
    h4
      margin: base-line 0 0 0
    & > header
      position: relative
      animation: slide-in-down
      animation-delay: 0.33s
      animation-duration: 0.35s
      animation-fill-mode: backwards
    & > div
      position: relative
      z-index: 1
    @media (prefers-color-scheme: dark)
      h1, h4, svg.background
        color: red
        fill: red
    & > h1
    & > div > figure
    & > div > form
      padding: base-line base-line 0 base-line
    & section.as-days
      padding-top: 0
      article.day
        @media (min-width: pad-begins)
          grid-auto-rows: auto
        @media (min-width: typing-begins)
          grid-auto-rows: auto
</style>
<style lang="stylus">
  section#account.signed-in > header
    margin-bottom: -(base-line * 4)
</style>
