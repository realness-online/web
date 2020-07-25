<template>
  <section id="feed" class="page">
    <header>
      <icon name="nothing" />
      <logo-as-link />
    </header>
    <hgroup>
      <h1>Feed</h1>
    </hgroup>
    <as-days v-if="signed_in" v-slot="items"
             :working="working"
             :posters="posters"
             :statements="statements">
      <div v-for="item in items" :key="slot_key(item)">
        <poster-as-figure v-if="item.type === 'posters'"
                          :itemid="item.id"
                          :verbose="true" />
        <thought-as-article v-else
                            :statements="item"
                            :verbose="true"
                            @thought-show="thought_shown" />
      </div>
    </as-days>
    <hgroup v-else class="sign-on message">
      <p><sign-on /> and you can check out <icon name="heart" /> who's on here</p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import { as_directory, list } from '@/helpers/itemid'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import as_days from '@/components/as-days'
  import sign_on from '@/components/sign-on'
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
    mixins: [signed_in],
    data () {
      return {
        signed_in: true,
        people: [],
        statements: [],
        posters: [],
        working: true
      }
    },
    async created () {
      console.clear()
      console.time('feed-load')
      this.people = await list(`${this.me}/relations`)
      this.people.push({
        id: this.me,
        type: 'person'
      })
      await this.fill_feed()
      console.timeEnd('feed-load')
      this.working = false
    },
    methods: {
      thought_shown (event) {
        console.log('thought-shown', event)
      },
      slot_key (item) {
        let slot_key = null
        if (Array.isArray(item) && item.length) slot_key = item[0].id
        if (item.id) slot_key = item.id
        return slot_key
      },
      async fill_feed () {
        await Promise.all(this.people.map(async relation => {
          const [statements, posters] = await Promise.all([
            list(`${relation.id}/statements`, this.me),
            as_directory(`${relation.id}/posters`, this.me)
          ])
          this.statements = [...statements, ...this.statements]
          if (posters) {
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
    & > hgroup
      & > h1
        padding: 0 base-line
        width:100vw
        margin-bottom: 0
    & > section.as-days
      & > article.day
        grid-auto-rows: auto
        & > header
          padding: 0 base-line
        article.thought
          padding: 0 base-line
        figure.poster > svg.background
          fill: blue
</style>
