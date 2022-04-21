<template>
  <section id="profile" class="page">
    <header>
      <realness-icon name="nothing" />
      <logo-as-link />
    </header>
    <div>
      <as-avatar v-if="person" :itemid="person.avatar" />
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
          :key="slot_key(item.id)"
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
<script setup>
  import AsDays from '@/components/as-days'
  import LogoAsLink from '@/components/logo-as-link'
  import AsDownload from '@/components/download-vector'
  import AsFigure from '@/components/profile/as-figure'
  import AsAvatar from '@/components/posters/as-svg'
  import AsMessenger from '@/components/profile/as-messenger'
  import ThoughtAsArticle from '@/components/statements/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'
  import RealnessIcon from '@/components/icon'
  import { from_e64 } from '@/use/profile'
  import { use as use_statements, slot_key } from '@/use/statements'
  import { use_posters } from '@/use/vector'
  import { use as use_person } from '@/use/people'
  import { ref, onMounted as mounted } from 'vue'
  import { useRoute as use_route } from 'vue-router'
  const route = use_route()
  const id = from_e64(route.params.phone_number)
  const {
    statements,
    thought_shown,
    for_person: statements_for_person
  } = use_statements()
  const { posters, for_person: posters_for_person } = use_posters()
  const { load_person, load_relations, person, relations } = use_person()
  mounted(async () => {
    await Promise.all([
      load_relations({ id: localStorage.me }),
      load_person(id),
      posters_for_person(id),
      statements_for_person(id)
    ])
    console.info('views:Profile', id)
  })
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
        figure.poster
          & > figcaption > menu
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
