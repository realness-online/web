<template lang="html">
  <section id="account" :class="{'signed-in': signed_in}" class="page">
    <header>
      <icon v-if="signed_in" name="nothing" />
      <sign-on v-else />
      <logo-as-link />
    </header>
    <div v-if="signed_in">
      <avatar-as-form :person="person" @new-avatar="new_avatar" />
      <profile-as-figure :person="person">
        <a @click="settings = !settings">
          <icon name="gear" />
        </a>
      </profile-as-figure>
      <menu v-if="settings" id="settings">
        <button @click="signoff">Sign off</button>
      </menu>
    </div>
    <h1>Statements</h1>
    <as-days v-slot="thoughts"
             itemscope
             :itemid="statements_id"
             :statements="statements">
      <thought-as-article v-for="thought in thoughts"
                          :key="thought[0].id"
                          :statements="thought"
                          :editable="is_editable(thought)"
                          @show="thought_shown"
                          @focused="thought_focused"
                          @blurred="thought_blurred" />
    </as-days>
    <hgroup v-if="statements.length === 0" class="message">
      <p>Say some stuff via the <button class="mock" /> button on the homepage</p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import { newest_number_first } from '@/helpers/sorting'
  import { load, list, as_directory } from '@/helpers/itemid'
  import { Me } from '@/persistance/Storage'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import as_days from '@/components/as-days'
  import logo_as_link from '@/components/logo-as-link'
  import sign_on from '@/components/profile/sign-on'
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
        pages_viewed: ['index'],
        image_file: null,
        settings: false,
        working: true,
        first_page: [],
        currently_focused: null
      }
    },
    computed: {
      statements_id () {
        return `${localStorage.me}/statements`
      }
    },
    async created () {
      console.info('Views account page')
      this.statements = await this.get_all_my_stuff()
      this.first_page = this.statements
      this.working = false
    },
    methods: {
      is_editable (thought) {
        if (this.working) return false
        return thought.some(statement => {
          return this.first_page.some(s => {
            return s.id === statement.id
          })
        })
      },
      signoff () {
        firebase.auth().signOut()
        this.$router.push({ path: '/sign-on' })
      },
      async get_all_my_stuff () {
        const [person, statements] = await Promise.all([
          load(localStorage.me),
          list(this.statements_id)
        ])
        if (person) this.person = person
        return statements
      },
      async new_avatar (avatar_url) {
        this.working = true
        this.person.avatar = avatar_url
        const me = new Me()
        await this.$nextTick()
        await me.save()
        this.working = false
      },
      async thought_shown (thought) {
        if (this.currently_focused) return
        const thought_oldest = thought[thought.length - 1]
        const oldest = this.statements[this.statements.length - 1]
        if (oldest.id === thought_oldest.id) {
          const directory = await as_directory(`${localStorage.me}/statements`)
          let history = directory.items
          history.sort(newest_number_first)
          history = history.filter(page => !this.pages_viewed.some(viewed => viewed === page))
          const next = history.shift()
          if (next) {
            const next_statements = await list(`${localStorage.me}/statements/${next}`)
            this.pages_viewed.push(next)
            this.statements = [...this.statements, ...next_statements]
          }
        }
      },
      async thought_focused (statement) {
        this.currently_focused = statement.id
        this.statements = await list(this.statements_id)
        this.pages_viewed = ['index']
      },
      thought_blurred (statement) {
        if (this.currently_focused === statement.id) {
          this.currently_focused = null
          const oldest = this.statements[this.statements.length - 1]
          this.thought_shown([oldest])
        }
      }
    }
  }
</script>
<style lang='stylus'>
  section#account
    @media (prefers-color-scheme: dark)
      h1, h4, svg.background
        color: red
        fill: red
    button, a
      border-color: red
      color: red
      border-color: red
    button.mock
      background-color: red
      border-radius: 0.2em
      height: 1.33em
    p[itemprop="statement"]:focus
      font-weight: 700
      outline: 0px
    h1
      margin: base-line
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
      & > button
        position: absolute
        bottom: .05rem
        right: 1em
    & section.as-days
      padding: base-line
      padding-top: 0
      article.day
        @media (min-width: pad-begins)
          grid-auto-rows: auto
        @media (min-width: typing-begins)
          grid-auto-rows: auto
</style>
<style lang="stylus">
  :root
    --header-margin:  -(base-line * 4)
  section#account.signed-in
    & > header
      margin-bottom: calc( var(--header-margin) - env(safe-area-inset-top))
    & > div
      & > figure
      & > form
        background-color: background-black
        padding: base-line base-line 0 base-line
      figure.profile > a > svg.gear
        margin-right: 0
        fill: red
        animation-name: rotate-back
        transform-origin: center
        transition-duration: 0.1s
        animation-iteration-count: 0.1
        transition-timing-function: ease-in-out
        &:active
          animation-name: rotate
          animation-iteration-count: 0.5
      menu#settings
        float:right
        width: 5rem
        margin-right: base-line
        margin-bottom: base-line
        display:flex
        justify-content: space-between
        animation-name: fade-in
        animation-duration: 0.2s
        margin-top: base-line
</style>
