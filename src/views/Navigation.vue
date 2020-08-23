<template>
  <section id="navigation" class="page" :class="{ posting }">
    <header>
      <h6 class="app_version">
        {{ version }}
      </h6>
    </header>
    <nav>
      <router-link v-if="!posting" to="/account" class="black" tabindex="-1">
        {{ first_name }}
      </router-link>
      <router-link v-if="!posting" to="/events" class="green" tabindex="-1">
        Tonight!
      </router-link>
      <router-link v-if="!posting" to="/posters" class="green" tabindex="-1">
        Posters
      </router-link>
      <router-link v-if="!posting" to="/feed" class="blue" tabindex="-1">
        Feed
      </router-link>
      <router-link v-if="!posting" to="/relations" class="blue" tabindex="-1">
        Relations
      </router-link>
      <button v-if="posting" tabindex="-1" @click="done_posting">Done</button>
      <statement-as-textarea class="red"
                             @toggle-keyboard="posting = !posting"
                             @statement-added="add_statement" />
    </nav>
    <footer hidden>
      <as-days v-slot="thoughts"
               itemscope
               :itemid="statements_id"
               :statements="statements">
        <thought-as-article v-for="thought in thoughts"
                            :key="thought[0].id"
                            :statements="thought" />
      </as-days>
    </footer>
  </section>
</template>
<script>
  import { Statements } from '@/persistance/Storage'
  import signed_in from '@/mixins/signed_in'
  import itemid from '@/helpers/itemid'
  import as_textarea from '@/components/statements/as-textarea'
  import as_days from '@/components/as-days'
  import thought_as_article from '@/components/statements/as-article'
  export default {
    components: {
      'as-days': as_days,
      'thought-as-article': thought_as_article,
      'statement-as-textarea': as_textarea
    },
    mixins: [signed_in],
    data () {
      return {
        relations: [],
        statements: [],
        version: process.env.VUE_APP_VERSION,
        signed_in: true,
        posting: false,
        first_name: 'You'
      }
    },
    computed: {
      has_statements () {
        return this.statements.length > 0
      },
      statements_id () {
        return `${localStorage.me}/statements`
      }
    },
    async created () {
      console.info('Views the navigation')
      await this.get_all_my_stuff()
    },
    methods: {
      async get_all_my_stuff () {
        const [my, statements, relations] = await Promise.all([
          itemid.load(localStorage.me),
          itemid.list(`${localStorage.me}/statements`),
          itemid.list(`${localStorage.me}/relations`)
        ])
        if (my && my.first_name) this.first_name = my.first_name
        this.statements = statements
        this.relations = relations
      },
      done_posting (event) {
        document.querySelector('nav > button').focus()
      },
      async add_statement (statement) {
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
    padding: 0 base-line
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
      // min-height: round(base-line * 9)
      // height: round(base-line * 9)
      & > textarea
        text-align: inherit
        margin-top: base-line
        padding: 0
        border-radius: 0
    & > header
      padding: 0
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
      & > a
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
    h6.app_version
      margin: 0
      padding: 0
      position: fixed
      bottom: (base-line / 2)
      left: (base-line / 2)
</style>
