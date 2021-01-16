<template lang="html">
  <section id="profile" class="page">
    <header>
      <icon name="nothing" />
      <logo-as-link />
    </header>
    <avatar v-if="person" :person="person" />
    <menu v-if="person">
      <as-download :itemid="person.avatar" />
    </menu>
    <as-figure v-if="person" :person="person" :relations="relations" />
    <as-days v-slot="items" :posters="posters" :statements="statements">
      <template v-for="item in items">
        <poster-as-figure v-if="item.type === 'posters'"
                          :key="slot_key(item)"
                          :itemid="item.id" />
        <thought-as-article v-else
                            :key="slot_key(item)"
                            :statements="item"
                            @show="thought_shown" />
      </template>
    </as-days>
  </section>
</template>
<script>
  import signed_in from '@/mixins/signed_in'
  import { from_e64 } from '@/helpers/profile'
  import intersection_thought from '@/mixins/intersection_thought'
  import { load, list, as_directory } from '@/helpers/itemid'
  import as_days from '@/components/as-days'
  import logo_as_link from '@/components/logo-as-link'
  import as_download from '@/components/download-vector'
  import as_figure from '@/components/profile/as-figure'
  import avatar from '@/components/avatars/as-svg'
  import as_article from '@/components/statements/as-article'
  import poster_as_figure from '@/components/posters/as-figure'
  import icon from '@/components/icon'
  export default {
    components: {
      icon,
      avatar,
      'as-days': as_days,
      'as-figure': as_figure,
      'as-download': as_download,
      'logo-as-link': logo_as_link,
      'poster-as-figure': poster_as_figure,
      'thought-as-article': as_article
    },
    mixins: [signed_in, intersection_thought],
    data () {
      return {
        working: true,
        person: null,
        statements: [],
        pages_viewed: ['index'],
        posters: [],
        relations: []
      }
    },
    async created () {
      const id = from_e64(this.$route.params.phone_number)
      const [person, statements, posters, my_relations] = await Promise.all([
        load(id),
        list(`${id}/statements`),
        as_directory(`${id}/posters`),
        list(`${localStorage.me}/relations`)
      ])
      if (person) {
        this.person = person
        this.authors.push({
          id: person.id,
          type: 'person',
          viewed: ['index']
        })
      } else return
      this.relations = my_relations
      this.statements = statements
      if (posters && posters.items) {
        posters.items.forEach(created_at => {
          this.posters.push({
            id: `${id}/posters/${created_at}`,
            type: 'posters'
          })
        })
      }
      console.info('views:profile')
    }
  }
</script>
<style lang='stylus'>
  section#profile
    padding-bottom: base-line
    & > header
      z-index: 2
      position: absolute
      animation: slide-in-down
      animation-delay: 1.3s
      animation-duration: 0.35s
      animation-fill-mode: backwards
      width:100%
      & > a
        -webkit-tap-highlight-color: blue
        & > svg
          fill: red
    & > svg:not(.working)
      width: 100vw
      min-height: 100vh
    & > menu > a.download
      position: absolute
      bottom: inset(bottom)
      right: inset(right)
      text-align: right
      animation: absolute-slide-up
      animation-delay: 1.3s
      animation-duration: 0.35s
      animation-fill-mode: backwards
      & > svg
        fill: blue
    svg.background
      fill: blue
    figure.profile
      padding: base-line
      & > svg
        border-radius: 0.66rem
        width: base-line * 2.5
        height: base-line * 2.5
        border-radius: base-line * 2
      & > figcaption > menu
        a.status
          position: absolute
          bottom: inset(bottom)
          left: inset(left)
          animation: absolute-slide-up
          animation-delay: 1.3s
          animation-duration: 0.35s
          animation-fill-mode: backwards
          svg.add
            width: base-line * 2
            height: base-line * 2
          &.relation
            svg.add
              width: 0
              height: 0
            svg.finished
              width: base-line * 2
              height: base-line * 2
        a.phone
          position: absolute
          top: inset(top)
          left: inset(left)
          z-index: 2
          animation: absolute-slide-down
          animation-delay: 1.3s
          animation-duration: 0.35s
          animation-fill-mode: backwards
          position: absolute
          svg.message
            fill: blue
    & > section.as-days
      & > article.day
        grid-auto-rows: auto
        & > header
          padding: base-line
        article.thought
          padding: 0 base-line
        figure.poster > svg.background
          fill: blue
</style>
