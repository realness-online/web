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
             :posters="posters"
             :statements="statements">
      <div v-for="item in items" :key="item.id">
        <poster-as-figure v-if="item.type === 'posters'" :itemid="item.id" />
        <thought-as-article v-else :statements="item" :verbose="true" />
      </div>
    </as-days>
    <hgroup v-else class="sign-on message">
      <p><sign-on /> and you can check out <icon name="heart" /> who's on here</p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import as_days from '@/components/as-days'
  import sign_on from '@/components/sign-on'
  import thought_as_article from '@/components/statements/as-article'
  import poster_as_figure from '@/components/posters/as-figure'
  import signed_in from '@/mixins/signed_in'
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
        posters: []
      }
    },
    async created () {
      console.time('feed-load')
      this.people = await itemid.list(`${this.me}/relations`)
      this.people.push({ id: this.me })
      await this.fill_feed()
      console.timeEnd('feed-load')
    },
    methods: {
      async fill_feed () {
        await Promise.all(this.people.map(async (relation) => {
          const [statements, posters] = await Promise.all([
            itemid.list(`${relation.id}/statements`, this.me),
            itemid.as_directory(`${relation.id}/posters`, this.me)
          ])
          if (statements) this.statements = [...statements, ...this.statements]
          if (posters) {
            posters.items.forEach(name => {
              this.posters.push({
                id: `${relation.id}/posters/${name}`,
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
      padding: base-line
    & > article.day
      padding: 0 base-line
      display:flex
      flex-direction: column
      &.today
        flex-direction: column-reverse
        & > header
          order: 1
      & > header > h4
        font-weight: 800
        margin-top: base-line
        margin-bottom: 0
      & > div
        & > figure > figcaption,
        & > article > header
          display: flex
          justify-content: flex-start
          flex-direction: row
          margin: base-line 0
          & a > svg
            cursor: pointer
            shape-outside: circle()
            border-radius: base-line
            margin-right: (base-line / 4)
          & > hgroup
            margin: 0
            & > span
              font-weight: 300
              display: inline-block
</style>
