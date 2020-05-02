<template>
  <section id="navigation" class="page" :class="{ posting }">
    <header><h6 class="app_version">{{version}}</h6></header>
    <nav :class="onboarding">
      <router-link v-if="!posting" to="/account" class="black" tabindex="-1">{{first_name}}</router-link>
      <router-link v-if="!posting" to="/events" class="green" tabindex="-1">Tonight!</router-link>
      <router-link v-if="!posting" to="/posters" class="green" tabindex="-1">Posters</router-link>
      <router-link v-if="!posting" to="/feed" class="blue" tabindex="-1">Feed</router-link>
      <router-link v-if="!posting" :to="friend_or_phone_book()" class="blue" tabindex="-1">Relations</router-link>
      <button v-if="posting" @click="done_posting" tabindex="-1">Done</button>
      <statement-as-textarea @toggle-keyboard="posting = !posting" @statement-added="add_statement" class="red"></statement-as-textarea>
    </nav>
    <footer hidden>
      <as-days itemscope :itemid="itemid" :statements="statements">
        <thought-as-article :item="item"></thought-as-article>
      </as-days>
    </footer>
  </section>
</template>
<script>
  import { Statements } from '@/persistance/Storage'
  import signed_in from '@/mixins/signed_in'
  import itemid from '@/helpers/itemid'
  import as_thoughts from '@/helpers/thoughts'
  import as_textarea from '@/components/statements/as-textarea'
  import as_days from '@/components/as-days'
  import thought_as_article from '@/components/statements/as-article'
  export default {
    mixins: [signed_in],
    components: {
      'as-days': as_days,
      'thought-as-article': thought_as_article,
      'statement-as-textarea': as_textarea
    },
    data () {
      return {
        has_statements: false,
        relations: [],
        statements: [],
        version: process.env.VUE_APP_VERSION,
        signed_in: true,
        posting: false,
        first_name: null
      }
    },
    async created () {
      console.info(`uses the navigation`)
      const [my, statements, relations] = await Promise.all([
        itemid.load(`${this.me}`),
        itemid.list(`${this.me}/statements`),
        itemid.list(`${this.me}/relations`)
      ])
      this.first_name = my.first_name || 'You'
      this.statements = as_thoughts(statements)
      this.relations = relations
    },
    computed: {
      onboarding () {
        return {
          'has-statements': this.has_statements,
          'signed-in': (this.has_statements && this.signed_in),
          'has-friends': (this.signed_in && this.relations.length > 0)
        }
      }
    },
    methods: {
      done_posting (event) {
        document.querySelector('nav > button').focus()
      },
      friend_or_phone_book () {
        if (this.relations.length < 1) return '/phone-book'
        else return '/relations'
      },
      async add_statement (statement) {
        this.has_statements = true
        this.statements.push(statement)
        await this.$nextTick()
        new Statements().save()
      }
    }
  }
</script>
<style lang="stylus">
  section#navigation.page
    width: 100%
    padding: base-line
    display: flex
    align-items: center
    margin: auto
    max-width: page-width
    height: 100vh
    @media (max-height: pad-begins) and (orientation: landscape)
      height: auto
    &.posting
      height: inherit
      align-items: flex-end
    &.posting > nav
      min-height: round(base-line * 9)
      height: round(base-line * 9)
      & > textarea
        text-align: inherit
        margin-top: base-line
        padding: 0
        border-radius: 0
    & > nav
      display: grid
      grid-gap: base-line
      grid-template-columns: 1fr 1fr
      grid-template-rows: repeat(1fr)
      align-items: stretch
      min-height: round(base-line * 18)
      max-height: page-width
      height: 100vmin
      width: 100vw
      &.has-statements
        & > [href='/account']
          visibility: visible
      &.signed-in
        & > [href='/posters']
        & > [href='/relations']
        & > [href='/phone-book']
          visibility: visible
      &.has-friends
        & > [href='/feed']
          visibility: visible
      & > a[href='/events']
        visibility: visible
      & > a
        visibility: hidden
        text-transform: capitalize
        text-align: left
        border-width: 1px
        border-style: solid
        &:focus
          color:transparent
          transition-duration: 0.6s
          transition: all
          outline: none
        &:nth-child(even)
         text-align: right
        &:active
          border-width: 1vmax
          color:transparent
      & > a
      & > textarea
        padding: base-line
        border-radius: base-line
      & > button
        align-self: flex-end
        width: base-line * 4
        display: block
      & > textarea
        text-align: right
    & > h6.app_version
      margin: 0
      padding: 0
      position: fixed
      bottom: (base-line / 2)
      left: (base-line / 2)
</style>
