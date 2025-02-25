<script setup>
  import { ref, watch, onMounted as mounted } from 'vue'
  import {
    useFullscreen as use_fullscreen,
    useMagicKeys as use_magic_keys
  } from '@vueuse/core'

  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import AsDays from '@/components/as-days'
  import ThoughtAsArticle from '@/components/statements/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'

  import { use as use_statements, slot_key } from '@/use/statement'
  import { use as use_people, use_me } from '@/use/people'
  import { use_posters } from '@/use/poster'

  console.time('views:Thoughts')

  const working = ref(true)
  const thoughts = ref(null)

  const { toggle: fullscreen, isFullscreen: is_fullscreen } =
    use_fullscreen(thoughts)
  const { f } = use_magic_keys()
  const { people } = use_people()
  const {
    for_person: statements_for_person,
    statements,
    thought_shown
  } = use_statements()
  const {
    for_person: posters_for_person,
    poster_shown,
    posters
  } = use_posters()
  const { relations } = use_me()

  const fill_thoughts = async () => {
    if (relations.value) people.value = [...relations.value]
    const me = {
      id: localStorage.me,
      type: 'person'
    }
    people.value.push(me)
    await Promise.all(
      people.value.map(async relation => {
        await Promise.all([
          statements_for_person(relation),
          posters_for_person(relation)
        ])
      })
    )
  }
  watch(f, v => {
    if (v) fullscreen()
  })
  mounted(async () => {
    await fill_thoughts()
    working.value = false
    console.timeEnd('views:Thoughts')
  })
</script>

<template>
  <section id="thoughts" ref="thoughts" class="page">
    <header>
      <icon v-if="is_fullscreen" name="nothing" />
      <a v-else tabindex="-1" @click="fullscreen">
        <icon name="nothin" />
      </a>
      <logo-as-link tabindex="-1" />
    </header>
    <h1>Thoughts</h1>
    <as-days
      v-slot="items"
      :working="working"
      :posters="posters"
      :statements="statements">
      <template v-for="item in items">
        <poster-as-figure
          v-if="item.type === 'posters'"
          :key="slot_key(item.id)"
          :itemid="item.id"
          @show="poster_shown" />
        <thought-as-article
          v-else
          :key="slot_key(item)"
          :statements="item"
          verbose
          @show="thought_shown" />
      </template>
    </as-days>
  </section>
</template>

<style lang="stylus">
  section#thoughts {
    position: relative;
    display: flex;
    flex-direction: column;
    @media (max-width: pad-begins) {
      figure.poster {
        margin-left: -(base-line);
        margin-right: -(base-line);
      }
    }
    & > header {
      & > h1 {
        width:auto;
        color: blue;
      }
      & > a:hover > svg {
        fill: green;
        transition-timing-function: ease-out;
      }
      & > a > svg {
        fill: blue;
      }
    }
    & > nav {
      display: none;
    }
    & > section.as-days {
      & > article.day {
        margin-bottom: base-line;
        @media (prefers-color-scheme: dark) {
          & > header h4, figure.poster > svg.background {
            color: blue;
          }
        }
      }
    }
    .working {
      fill: blue;
    }
  }
</style>
