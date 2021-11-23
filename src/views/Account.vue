<template>
  <section id="account" :class="{ 'signed-in': signed_in }" class="page">
    <header>
      <sign-on v-if="!signed_in" />
      <logo-as-link />
    </header>
    <address v-if="signed_in && !working">
      <avatar-as-form
        v-model:person="person"
        @update:person="$emit('update:person', $event)" />
      <profile-as-figure
        v-model:person="person"
        :editable="true"
        @update:person="$emit('update:person', $event)">
        <a @click="settings = !settings">
          <icon name="gear" />
        </a>
      </profile-as-figure>
      <menu v-if="settings" id="settings">
        <button @click="signoff">Sign off</button>
      </menu>
    </address>
    <h1 v-if="!working">Statements</h1>
    <as-days
      v-slot="thoughts"
      itemscope
      :paginate="false"
      :itemid="statements_id"
      :statements="statements">
      <thought-as-article
        v-for="thought in thoughts"
        :key="thought[0].id"
        :statements="thought"
        :editable="is_editable(thought)"
        @show="thought_shown"
        @focused="thought_focused"
        @blurred="thought_blurred" />
    </as-days>
    <footer v-if="statements.length === 0 && !working" class="message">
      <p>
        Say some stuff via the <button @click="home" /> button on the homepage
        <br />
      </p>
    </footer>
  </section>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/auth'
  import { load, list } from '@/helpers/itemid'
  import signed_in from '@/mixins/signed_in'
  import intersection_thought from '@/mixins/intersection_thought'
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
    mixins: [signed_in, intersection_thought],
    emits: ['update:person'],
    data() {
      return {
        person: {},
        statements: [],
        signed_in: true,
        pages_viewed: ['index'],
        image_file: null,
        settings: false,
        working: true,
        first_page: [],
        currently_focused: null
      }
    },
    computed: {
      statements_id() {
        return `${localStorage.me}/statements`
      }
    },
    async created() {
      console.info('views:Account')
      this.authors.push({
        id: localStorage.me,
        type: 'person',
        viewed: ['index']
      })
      await this.get_all_my_stuff()
      this.first_page = this.statements
      this.working = false
    },
    methods: {
      is_editable(thought) {
        if (this.working) return false
        return thought.some(statement => {
          return this.first_page.some(s => {
            return s.id === statement.id
          })
        })
      },
      signoff() {
        firebase.auth().signOut()
        this.$router.push({ path: '/sign-on' })
      },
      home() {
        this.$router.push({ path: '/' })
      },
      async get_all_my_stuff() {
        const [person, statements] = await Promise.all([
          load(localStorage.me),
          list(this.statements_id)
        ])
        if (person) this.person = person
        this.statements = statements
      },
      async thought_focused(statement) {
        this.currently_focused = statement.id
        this.statements = await list(this.statements_id)
        this.pages_viewed = ['index']
      },
      thought_blurred(statement) {
        if (this.currently_focused === statement.id) {
          this.currently_focused = null
          const oldest = this.statements[this.statements.length - 1]
          this.thought_shown([oldest])
        }
      }
    }
  }
</script>
<style lang="stylus">
  section#account
    a
    button
    time
      color: red
      border-color: red
    &.signed-in
      padding-top: 0
      & > h1
        margin-top: base-line
      & > header
        height: 0
        padding: 0
    & > header
      & > button.sign-on
      & > a#logo
        position: absolute
        top: inset(top)
        z-index: 2
      & > button.sign-on
        left: inset(left)
        height: round(base-line * 2, 2)
      & > a#logo
        right: inset(right)
    & > address
      position: relative
      z-index: 1
      & > figure
      & > form
        padding: base-line base-line 0 base-line
      & > figure
        & > svg
          width: base-line * 2
          height: base-line * 2
          border-radius: base-line * 2
          border-color: red
        & > figcaption
          padding: 0
          & > address
            flex-direction: row
            align-items: center
            & > b
             margin-bottom: 0
          & > menu
            justify-content: center
            opacity: 1
            padding: 0
            & > a > svg.gear
              fill: red
              animation-name: rotate-back
              transform-origin: center
              transition-duration: 0.1s
              animation-iteration-count: 0.1
              transition-timing-function: ease-in-out
              &:active
                transition-timing-function: ease-in-out
                animation-name: rotate
                animation-iteration-count: 0.5
      & > menu
        float:right
        width: 6rem
        margin-bottom: base-line
        display:flex
        justify-content: space-between
        animation-name: fade-in
        animation-duration: 0.2s
        margin-top: base-line
        & > button:hover
          transition: color
          transition-duration: 0.5s
          color: hsla(353, 83%, 57%, 1) // #ec364c
      & > button
        position: absolute
        bottom: .05rem
        right: 1em
    & > h1
      margin-top: base-line * 2
      padding: base-line
    & > section.as-days
      padding-top: 0
      h4
        margin: base-line 0 0 0
      article.day p[itemprop="statement"]:focus
        font-weight: bolder
        outline: 0px
    & > footer
      text-align: center
      padding: 0 base-line
      & > p
        max-width: inherit
        & > button
          background-color: red
          border-width: 1px
          border-radius: 0.2em
          height: 1em
          width: 1.66em
    @media (prefers-color-scheme: dark)
      h1, h4, svg.background
        color: red
        fill: red
</style>
