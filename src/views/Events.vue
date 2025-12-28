<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import AsDays from '@/components/as-days'
  import AsFigure from '@/components/posters/as-figure'

  import { ref, onMounted as mounted } from 'vue'
  import { list } from '@/utils/itemid'
  import { recent_item_first } from '@/utils/sorting'
  import icon from '@/components/icon'
  import { use_keymap } from '@/use/key-commands'

  const events = ref([])
  const working = ref(true)

  const get_upcoming_events = async () => {
    const [relations, my_events] = await Promise.all([
      list(`${localStorage.me}/relations`),
      list(`${localStorage.me}/events`)
    ])
    let all_events = my_events
    await Promise.all(
      relations.map(async person => {
        const relation_events = await list(`${person.id}/events`)
        all_events = [...relation_events, ...all_events]
      })
    )
    all_events.sort(recent_item_first)
    const now = new Date().getTime()
    return all_events.filter(event => event.id > now)
  }
  const { register } = use_keymap('Events')

  register('events::New_Event', () => {})
  register('events::Search', () => {})
  register('events::Open_Event', () => {})
  register('events::Remove_Event', () => {})

  mounted(async () => {
    events.value = await get_upcoming_events()
    working.value = false
    console.info('views:events', events.value.length)
  })
</script>

<template>
  <section id="events" class="page">
    <header>
      <logo-as-link />
      <icon name="nothing" />
    </header>
    <h1>Events</h1>
    <icon v-show="working" name="working" />
    <as-days id="tonight" v-slot="items" :paginate="false" :events="events">
      <as-figure v-for="item in items" :key="item.url" :itemid="item.url" />
    </as-days>
    <footer v-if="!events.length">
      <p class="message">
        You create events from
        <router-link to="/posters">Posters</router-link>
      </p>
    </footer>
  </section>
</template>

<style lang="stylus">
  section#events {
    & > header > svg {
      width: base-line * 2;
      height: base-line * 2;
      fill: transparent;
    }
    & > h1 {
      color: green;
    }
    & > article {
      standard-grid: howdy;
      & > figure {
        & > svg.background {
          fill: green;
        }
        & > figcaption menu a {
          svg.message, svg.download, svg.background {
            fill: green;
          }
          & address > h3,
          & address > time {
            color: green;
          }
        }
      }
      & > header {
        max-height: base-line * 6;
      }
      @media (min-width: pad-begins) {
        & > header > h1 {
          padding: 0;
        }
      }
    }
    & > footer {
      display: flex;
      flex-direction: column;
      justify-content: space-evenly;
      align-items: center;
      p.message {
        padding: 0 base-line;
        svg, a, button, span {
          border-color: green;
          fill: green;
          color: green;
        }
      }
    }
  }
</style>
