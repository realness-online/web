<template>
  <section id="feed" ref="feed" class="page">
    <header>
      <logo-as-link tabindex="-1" />
      <h1>Feed</h1>
      <icon v-if="is_fullscreen" name="nothing" />
      <a v-else tabindex="-1" @click="fullscreen">
        <icon name="fullscreen" />
      </a>
    </header>
    <as-days v-slot="items" :working="working" :posters="posters" :statements="statements">
      <template v-for="item in items">
        <poster-as-figure
          v-if="item.type === 'posters'"
          :key="slot_key(item)"
          :itemid="item.id"
          :verbose="true" />
        <thought-as-article
          v-else
          :key="slot_key(item)"
          :statements="item"
          :verbose="true"
          @show="thought_shown" />
      </template>
    </as-days>
  </section>
</template>

<script>
  import firebase from 'firebase/app'
  import 'firebase/auth'
  import { list, as_directory, load } from '@/helpers/itemid'
  import signed_in from '@/mixins/signed_in'
  import intersection_thought from '@/mixins/intersection_thought'
  export default {
    mixins: [signed_in, intersection_thought],
    data() {
      return {
        signed_in: true,
        statements: [],
        posters: [],
        working: true,
        count: 0
      }
    },
    computed: {
      show_message() {
        if (this.working) return false
        if (this.statements.length === 0 && this.posters.length === 0) return true
        return false
      }
    },
    async created() {
      console.time('views:Feed')
      firebase.auth().onAuthStateChanged(async user => {
        if (user) {
          const authors = await list(`${localStorage.me}/relations`)
          await Promise.all(
            authors.map(async a => {
              const person = await load(a.id)
              if (person) this.authors.push(person)
            })
          )
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
      async fill_feed() {
        await Promise.all(
          this.authors.map(async relation => {
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
          })
        )
      }
    }
  }
</script>

<script setup>
  import icon from '@/components/icon'
  import logoAsLink from '@/components/logo-as-link'
  import asDays from '@/components/as-days'
  import thoughtAsArticle from '@/components/statements/as-article'
  import posterAsFigure from '@/components/posters/as-figure'

  import { watch, ref } from 'vue'
  import { useFullscreen as use_fullscreen, useMagicKeys as use_magic_keys } from '@vueuse/core'

  const feed = ref(null)
  const { toggle: fullscreen, isFullscreen: is_fullscreen } = use_fullscreen(feed)

  const { f } = use_magic_keys()
  watch(f, v => {
    if (v) fullscreen()
  })
</script>

<style lang="stylus">
  section#feed
    position: relative
    display: flex
    flex-direction: column
    @media (max-width: pad-begins)
      figure.poster
        margin-left: -(base-line)
        margin-right: -(base-line)
    &:fullscreen
    &:full-screen
      background-color: background-black
      flex-direction: row
      overflow-x: auto
      display: flex;
      padding: 0
      & > header
      article.day > header
      article.thought
        display: none
      section.as-days
        white-space: nowrap;
        overflow-x: auto;
        scroll-behavior: smooth
        scroll-snap-type: both mandatory
        padding: 0
        margin: 0
        & > article.day
          scroll-behavior: smooth
          scroll-snap-type: both mandatory
          scroll-snap-align: start end
          display: flex
          flex-direction: row
          grid-gap:0
          margin: 0
          figure.poster
            scroll-behavior: smooth
            scroll-snap-align: center
            border-radius: 0
            min-width: 100vw
            height: 100vh
            figcaption
              display: none
    & > header
      & > h1
        width:auto
        color: blue
      & > a:hover > svg
        fill: green
        transition-timing-function: ease-out
      & > a > svg
        fill: blue
    & > nav
      display: none
    & > section.as-days
      & > article.day
        margin-bottom: base-line
        @media (prefers-color-scheme: dark)
          & > header h4, figure.poster > svg.background
            color: blue
</style>
