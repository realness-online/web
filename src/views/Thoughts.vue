<script setup>
  import { ref, inject, provide, onMounted as mounted } from 'vue'
  import Icon from '@/components/icon'
  import AsDays from '@/components/as-days'
  import ThoughtAsArticle from '@/components/thoughts/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'

  import { as_author } from '@/utils/itemid'
  import { use as use_thoughts, slot_key } from '@/use/thought'
  import { use as use_people, use_me } from '@/use/people'
  import { use_posters } from '@/use/poster'
  import { use_keymap } from '@/use/key-commands'
  import { storytelling } from '@/utils/preference'
  import { get_my_itemid } from '@/use/people'

  console.time('views:Thoughts')

  const set_working = inject('set_working')
  const working = ref(true)
  const statements_ref = ref(null)

  const { people } = use_people()
  const {
    for_person: thoughts_for_person,
    thoughts,
    my_thoughts,
    statement_shown,
    update_thought
  } = use_thoughts()
  provide('update_thought', update_thought)
  const {
    for_person: posters_for_person,
    poster_shown,
    posters
  } = use_posters()
  const { relations } = use_me()

  const me_id = () =>
    (typeof window !== 'undefined' ? window.localStorage?.me : null) ?? null
  const is_editable = item => {
    const my_id = me_id()
    if (!my_id) return false
    return as_author(item?.[0]?.id) === my_id
  }

  const fill_statements = async () => {
    if (relations.value) people.value = [...relations.value]
    const my_id = me_id()
    if (my_id) people.value.push({ id: my_id, type: 'person' })

    await Promise.all(
      people.value.map(async relation => {
        await Promise.all([
          thoughts_for_person({ id: relation.id }),
          posters_for_person({ id: relation.id })
        ])
      })
    )
  }

  use_keymap('Thoughts')

  mounted(async () => {
    if (set_working) set_working(true)
    await fill_statements()
    working.value = false
    if (set_working) set_working(false)
    console.timeEnd('views:Thoughts')
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
      <router-link to="/posters" tabindex="-1">Posters</router-link>
    </header>
    <h1>Thoughts</h1>
    <as-days
      v-slot="{ day }"
      :working="working"
      :posters="posters"
      :thoughts="thoughts"
      itemscope
      :itemid="get_my_itemid('thoughts')">
      <template v-for="item in day" :key="slot_key(item)">
        <poster-as-figure
          v-if="item.type === 'posters'"
          :itemid="item.id"
          @show="poster_shown" />
        <thought-as-article
          v-else
          :statements="item"
          :editable="is_editable(item)"
          verbose
          @show="statement_shown" />
      </template>
    </as-days>
    <footer v-if="!my_thoughts?.length && !working" class="message">
      <p>
        Say some stuff using the
        <button
          aria-label="Focus thought input"
          @click="() => document.querySelector('textarea#wat')?.focus()">
          ✏️
        </button>
        in the footer
      </p>
    </footer>
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
      display: flex;
      align-items: center;
      gap: base-line;
      & > h1 {
        width:auto;
        color: blue;
      }
      & > a {
        color: blue;
        &:hover {
          color: green;
          & > svg {
            fill: green;
          }
        }
        & > svg {
          fill: blue;
        }
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
      h4 {
        margin: base-line 0 0 0;
      }
      article.day p[itemprop='thought']:focus {
        font-weight: bolder;
        outline: 0;
      }
    }
    .working {
      fill: blue;
    }
    & > footer.message {
      text-align: center;
      padding: 0 base-line;
      & > p {
        margin: auto;
        max-width: inherit;
        & > button {
          background: red;
          border-width: 1px;
          border-radius: 0.2em;
          height: 1em;
          width: 1.66em;
        }
        a, button, time {
          color: red;
          border-color: red;
        }
      }
    }
  }
</style>
