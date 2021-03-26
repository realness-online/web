<template>
  <section id="feed" class="page">
    <header>
      <icon name="nothing" />
      <logo-as-link />
    </header>
    <hgroup>
      <h1>Feed</h1>
    </hgroup>
    <as-days v-slot="items"
             :working="working"
             :posters="posters"
             :statements="statements">
      <template v-for="item in items">
        <poster-as-figure v-if="item.type === 'posters'"
                          :key="slot_key(item)"
                          :immediate="should_immediate()"
                          :itemid="item.id"
                          :verbose="true" />
        <thought-as-article v-else
                            :key="slot_key(item)"
                            :statements="item"
                            :verbose="true"
                            @show="thought_shown" />
      </template>
    </as-days>
    <hgroup v-if="show_message" class="sign-on message">
      <p>A feed of statements and posters</p>
      <p>If you <sign-on /> you can check out <icon name="heart" /> who else is on here</p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/auth'
  import { list, as_directory, load } from '@/helpers/itemid'
  import signed_in from '@/mixins/signed_in'
  import intersection_thought from '@/mixins/intersection_thought'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import as_days from '@/components/as-days'
  import sign_on from '@/components/profile/sign-on'
  import thought_as_article from '@/components/statements/as-article'
  import poster_as_figure from '@/components/posters/as-figure'
  export default {
    components: {
      'sign-on': sign_on,
      'as-days': as_days,
      'logo-as-link': logo_as_link,
      'thought-as-article': thought_as_article,
      'poster-as-figure': poster_as_figure,
      icon
    },
    mixins: [signed_in, intersection_thought],
    data () {
      return {
        signed_in: true,
        statements: [],
        posters: [],
        working: true,
        count: 0
      }
    },
    computed: {
      show_message () {
        if (this.working) return false
        if (this.statements.length === 0 && this.posters.length === 0) return true
        return false
      }
    },
    async created () {
      console.time('views:Feed')
      firebase.auth().onAuthStateChanged(async user => {
        if (user) {
          const authors = await list(`${localStorage.me}/relations`)
          await Promise.all(authors.map(async a => {
            const person = await load(a.id)
            if (person) this.authors.push(person)
          }))
        }
        this.authors.push({
          id: localStorage.me,
          type: 'person'
        })
        await this.fill_feed()
        console.timeEnd('views:Feed')
        this.working = false
      })
    },
    methods: {
      should_immediate (index) {
        if (this.count < 3) {
          this.count++
          return true
        } else return false
      },
      async fill_feed () {
        await Promise.all(this.authors.map(async relation => {
          const [statements, posters] = await Promise.all([
            list(`${relation.id}/statements`),
            as_directory(`${relation.id}/posters`)
          ])
          relation.viewed = ['index']
          this.statements = [...statements, ...this.statements]
          if (posters && posters.items) {
            posters.items.forEach(created_at => {
              this.posters.push({
                id: `${relation.id}/posters/${created_at}`,
                type: 'posters'
              })
            })
          }
        }))
      }
    }
  }
</script>
<style lang="stylus">
  section#feed
    position: relative
    display: flex
    flex-direction: column
    & > header > svg
      fill: transparent
    & > nav
      display: none
    & > section.as-days
      & > article.day
        margin-bottom: base-line
        grid-auto-rows: auto
        & > header
          padding: base-line
          h4
            @media (prefers-color-scheme: dark)
              color: blue
        article.thought
          padding: 0 base-line
        figure.poster > svg.background
          @media (prefers-color-scheme: dark)
            fill: blue
</style>
