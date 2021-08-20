<template>
  <section id="events" class="page">
    <header>
      <icon name="nothing" />
      <logo-as-link />
    </header>
    <hgroup>
      <h1>Events</h1>
      <icon v-show="working" name="working" />
    </hgroup>
    <article v-if="events.length" id="tonight">
      <as-figure v-for="event in events" :key="event.url" :itemid="event.url" />
    </article>
    <hgroup v-else class="message">
      <p><span>Zero</span> public events. You create events from <router-link to="/posters">Posters</router-link>.</p>
      <p v-if="!signed_in">People see them after you <sign-on /></p>
    </hgroup>
  </section>
</template>
<script>
  import { list } from '@/helpers/itemid'
  import { recent_item_first } from '@/helpers/sorting'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import sign_on from '@/components/profile/sign-on'
  import logo_as_link from '@/components/logo-as-link'
  import as_figure from '@/components/posters/as-figure'
    export default {
    components: {
      'sign-on': sign_on,
      'logo-as-link': logo_as_link,
      'as-figure': as_figure,
      icon
    },
    mixins: [signed_in],
    data () {
      return {
        events: [],
        upcoming: [],
        working: true,
        days: new Map()
      }
    },
    async created () {
      console.info('views:events')
      this.events = await this.get_upcoming_events()
      this.working = false
    },
    methods: {
      async get_upcoming_events () {
        const [relations, my_events] = await Promise.all([
          list(`${localStorage.me}/relations`),
          list(`${localStorage.me}/events`)
        ])
        let events = my_events
        await Promise.all(relations.map(async person => {
          const relation_events = await list(`${person.id}/events`)
          events = [...relation_events, ...events]
        }))
        events.sort(recent_item_first)
        const now = new Date().getTime()
        events = events.filter(event => event.id > now)
        return events
      }
    }
  }
</script>
<style lang="stylus">
  section#events
    hgroup.message
      padding: 0 base-line
      svg, a, button, span
        border-color: green
        fill: green
        color: green
    h1
      padding: 0 base-line base-line base-line
      color: green
    & > header
      & > svg
        width: base-line * 2
        height: base-line * 2
        fill: transparent
      & > a
        -webkit-tap-highlight-color: green
    & > article
      padding-bottom: base-line * 3
      standard-grid: howdy
      & > figure
        & > svg.background
          fill:green
        & > figcaption menu a
          svg.background
            fill: red
          hgroup > h3,
          hgroup > time
            color: red
      & > header
        max-height: base-line * 6
      @media (min-width: pad-begins)
        & > header > h1
          padding: 0
</style>
