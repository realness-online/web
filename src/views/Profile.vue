<template>
  <section id="profile" class="page">
    <header>
      <icon name="nothing" />
      <logo-as-link />
    </header>
    <div>
      <avatar v-if="person" :person="person" />
      <menu v-if="person">
        <as-download :itemid="person.avatar" />
        <as-messenger :itemid="person.id" />
      </menu>
    </div>
    <as-figure v-if="person" :person="person" :relations="relations" />
    <as-days v-slot="items" :posters="posters" :statements="statements">
      <template v-for="item in items">
        <poster-as-figure
          v-if="item.type === 'posters'"
          :key="slot_key(item)"
          :itemid="item.id" />
        <thought-as-article
          v-else
          :key="slot_key(item)"
          :statements="item"
          @show="thought_shown" />
      </template>
    </as-days>
  </section>
</template>
<script>
  import signed_in from '@/mixins/signed_in'
  import { from_e64 } from '@/use/profile'
  import intersection_thought from '@/mixins/intersection_thought'
  import { load, list, as_directory } from '@/use/itemid'
  import as_days from '@/components/as-days'
  import logo_as_link from '@/components/logo-as-link'
  import as_download from '@/components/download-vector'
  import as_figure from '@/components/profile/as-figure'
  import as_messenger from '@/components/profile/as-messenger'
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
      'as-messenger': as_messenger,
      'as-download': as_download,
      'logo-as-link': logo_as_link,
      'poster-as-figure': poster_as_figure,
      'thought-as-article': as_article
    },
    mixins: [signed_in, intersection_thought],
    data() {
      return {
        working: true,
        person: null,
        statements: [],
        pages_viewed: ['index'],
        posters: [],
        relations: []
      }
    },
    async created() {
      const id = from_e64(this.$route.params.phone_number)
      const [person, statements, posters, my_relations] = await Promise.all([
        load(id),
        list(`${id}/statements`),
        as_directory(`${id}/posters`),
        list(`${localStorage.me}/relations`)
      ])
      this.person = person
      this.authors.push({
        id: person.id,
        type: 'person',
        viewed: ['index']
      })
      this.relations = my_relations
      this.statements = statements
      posters.items.forEach(created_at => {
        this.posters.push({
          id: `${id}/posters/${created_at}`,
          type: 'posters'
        })
      })
      console.info('views:Profile')
    }
  }
</script>
<style lang="stylus">
  section#profile
    padding: 0
    & > header
      height: 0
      padding: 0
      & > a
        -webkit-tap-highlight-color: blue
        z-index: 2
        top: inset(top)
        right: base-line
        position: absolute
    & > div
      position: relative
      overflow: hidden
      & > svg
        width: 100vw
        min-height: 100.5vh
      & > menu
        width: 100%
        display: flex
        justify-content: space-between
        z-index: 1
        position: absolute
        bottom: -(base-line * 2)
        bottom: 0
        padding: 0 base-line
        animation: absolute-slide-up
        animation-delay: 1.33s
        animation-duration: 0.35s
        animation-fill-mode: both
        & > a > svg
          fill: blue
    & > figure.profile
      padding: base-line
      & > svg
        border-radius: 0.66em
        width: base-line * 2
        height: base-line * 2
        border-radius: base-line
      & > figcaption > menu
        a.status
          position: absolute
          animation: absolute-slide-down
          animation-delay: 1.33s
          animation-duration: 0.35s
          animation-fill-mode: both
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
          display: none
    & > section.as-days
      & > article.day
        @media (prefers-color-scheme: dark)
          & > header > h4, figure.poster > svg.background
            color: blue
        figure.poster > figcaption > menu
          & > a.download svg
            fill: blue
          & > a.phone
            display: none
          & > a.profile
            & > address
              & > time
                font-size: max-font
                color: blue
              & > h3
                display: none
            & > svg
              display: none
</style>
