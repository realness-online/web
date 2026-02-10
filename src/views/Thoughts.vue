<script setup>
  import { ref, inject, onMounted as mounted } from 'vue'
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import AsDays from '@/components/as-days'
  import ThoughtAsArticle from '@/components/statements/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'

  import { use as use_statements, slot_key } from '@/use/statement'
  import { use as use_people, use_me } from '@/use/people'
  import { use_posters } from '@/use/poster'
  import { use_keymap } from '@/use/key-commands'
  import { storytelling } from '@/utils/preference'

  console.time('views:Thoughts')

  const set_working = inject('set_working')
  const working = ref(true)
  const thoughts = ref(null)

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
          statements_for_person({ id: relation.id }),
          posters_for_person({ id: relation.id })
        ])
      })
    )
  }

  // Use keymap context with automatic lifecycle management
  const { register } = use_keymap('Thoughts')

  register('thoughts::Search', () => {})
  register('thoughts::NewThought', () => {})
  register('thoughts::ClearSearch', () => {})

  mounted(async () => {
    if (set_working) set_working(true)
    await fill_thoughts()
    working.value = false
    if (set_working) set_working(false)
    console.timeEnd('views:Thoughts')
  })
</script>

<template>
  <section
    id="thoughts"
    ref="thoughts"
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
      & > figure.poster {
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
