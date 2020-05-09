<template>
  <section id="feed" class="page">
    <header>
      <icon name='nothing'></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Feed</h1>
    </hgroup>
    <as-days :posters="posters" :statements="statements">
      <template v-slot:item="{ item }">
        <poster-as-figure v-if="item.type === 'posters'"
                          :poster="item">
                          </poster-as-figure>
        <thought-as-article v-else
                            :item="item"
                            :verbose="true"
                            @viewed="statement_viewed">
                            </thought-as-article>
      </template>
    </as-days>
  </section>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import as_days from '@/components/as-days'
  import thought_as_article from '@/components/statements/as-article'
  import poster_as_figure from '@/components/feed/as-figure'
  import signed_in from '@/mixins/signed_in'
  export default {
    mixins: [signed_in],
    components: {
      'as-days': as_days,
      'logo-as-link': logo_as_link,
      'thought-as-article': thought_as_article,
      'poster-as-figure': poster_as_figure,
      icon
    },
    data () {
      return {
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
          this.statements = [...statements, ...this.statements]
          this.posters = [...posters.items, ...this.posters]
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
    @media (min-width: pad-begins)
      max-width: page-width
    & > header > svg
      fill: transparent
    & > div
      display: none
    & > nav
      display: none
    & > hgroup > h1
      margin-bottom: 0
    & > svg.working
      order: 1
      margin: base-line auto
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
