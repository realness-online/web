<script setup>
  import { ref, inject, onMounted as mounted } from 'vue'
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import AsDays from '@/components/as-days'
  import ThoughtAsArticle from '@/components/thoughts/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'

  import { use as use_thoughts, slot_key } from '@/use/thought'
  import { use as use_people, use_me } from '@/use/people'
  import { use_posters } from '@/use/poster'
  import { use_keymap } from '@/use/key-commands'
  import { storytelling } from '@/utils/preference'

  console.time('views:Statements')

  const set_working = inject('set_working')
  const working = ref(true)
  const statements_ref = ref(null)

  const { people } = use_people()
  const {
    for_person: thoughts_for_person,
    thoughts,
    statement_shown
  } = use_thoughts()
  const {
    for_person: posters_for_person,
    poster_shown,
    posters
  } = use_posters()
  const { relations } = use_me()

  const fill_statements = async () => {
    if (relations.value) people.value = [...relations.value]
    const me = {
      id: localStorage.me,
      type: 'person'
    }
    people.value.push(me)
    await Promise.all(
      people.value.map(async relation => {
        await Promise.all([
          thoughts_for_person({ id: relation.id }),
          posters_for_person({ id: relation.id })
        ])
      })
    )
  }

  use_keymap('Statements')

  mounted(async () => {
    if (set_working) set_working(true)
    await fill_statements()
    working.value = false
    if (set_working) set_working(false)
    console.timeEnd('views:Statements')
  })
</script>

<template>
  <section
    id="thoughts"
    ref="statements_ref"
    class="page"
    :class="{ storytelling: storytelling }">
    <header>
      <icon name="nothing" />
      <logo-as-link tabindex="-1" />
    </header>
    <h1>Thoughts</h1>
    <as-days
      v-slot="items"
      :working="working"
      :posters="posters"
      :thoughts="thoughts">
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
          @show="statement_shown" />
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
      & > section.as-days {
        padding-left: 0;
        padding-right: 0;
      }
      & > section.as-days article.day > header {
        padding-left: base-line;
        padding-right: base-line;
      }
      & > section.as-days article.thought {
        padding-left: base-line;
        padding-right: base-line;
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
