<template>
  <section id="events" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Tonight!</h1>
      <icon v-show="working" name="working"></icon>
    </hgroup>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import { relations_storage, person_storage as me } from '@/persistance/Storage'
  import profile from '@/helpers/profile'
  import signed_in from '@/mixins/signed_in'
  import logo_as_link from '@/components/logo-as-link'
  import icon from '@/components/icon'
  export default {
    mixins: [signed_in],
    components: {
      'logo-as-link': logo_as_link,
      icon
    },
    data() {
      return {
        relations: [],
        working: true,
        days: new Map(),
        storage: firebase.storage().ref()
      }
    },
    created() {
      console.clear()
      console.time('events-load')
      this.events = this.get_upcoming_events()
      console.timeEnd('events-load')
    },
    methods: {
      async get_upcoming_events() {
        const relations = relations_storage.as_list()
        relations.push(me.as_object())
        // let events = this.storage.child('upcoming.html').getDownloadURL()
        let events = []
        await Promise.all(relations.map(async (relation) => {
          const relation_events = await profile.items(relation.id, 'events/upcoming')
          events = [...relation_events, ...events]
        }))
        events.sort(this.newer_first)
        // sort events into nights
        // filter out any events that already happened
        // events.forEach(event => this.insert_event_into_day(event, this.days))
      },
      newer_first(earlier, later) {
        return later.id - earlier.id
      }
    }
  }
</script>
<style lang="stylus">
  section#events
    h1
      color: green
    & > header
      margin: auto
      @media (min-width: mid-screen)
        max-width: page-width
      & > svg
        width: base-line * 2
        height: base-line * 2
        fill: transparent
      & > a
        -webkit-tap-highlight-color: green
    & > figure
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-gap: base-line
      @media (min-width: max-screen)
        padding: 0 base-line
      & > svg
        display: block
        width: 100%
        min-height: 66vh
        height: inherit

</style>
