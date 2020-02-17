<template>
  <section id="posters" class="page">
    <input type="file" accept="image/jpeg" ref="uploader" v-uploader>
    <header v-show="!new_poster">
      <a @click="select_photo"><icon name="add"></icon></a>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup v-show="!new_poster">
      <h1>Posters</h1>
      <icon v-show="working" name="working"></icon>
    </hgroup>
    <article itemprop="posters">
      <as-figure v-if="new_poster"
                 class="new"
                 :is_new="true"
                 :poster="new_poster"
                 :author="me"
                 :working="working"
                 @add-poster="add_poster"
                 @remove-poster="remove_new_poster"
                 v-bind:key="as_itemid"></as-figure>
      <as-figure v-else v-for="poster in posters"
                 :author="me"
                 :poster="poster"
                 :events="events"
                 :working="working"
                 @remove-poster="remove_poster"
                 @add-event="add_event"
                 @remove-event="remove_event"
                 v-bind:key="poster.id"></as-figure>
    </article>
    <aside>
      <ol ref="events" itemprop="events">
        <li itemscope itemtype="/events" v-for="event in events" :itemid="event.id" v-bind:key="event.id" >
          <link itemprop="poster" rel="icon" :href="event.poster">
        </li>
      </ol>
    </aside>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import { posters_storage,
           events_storage,
           person_storage as me } from '@/persistance/Storage'
  import Item from '@/modules/item'
  import icon from '@/components/icon'
  import as_figure from '@/components/posters/as-figure'
  import logo_as_link from '@/components/logo-as-link'
  import uploader from '@/mixins/uploader'
  import signed_in from '@/mixins/signed_in'
  export default {
    mixins: [signed_in, uploader],
    components: {
      'as-figure': as_figure,
      'logo-as-link': logo_as_link,
      icon
    },
    data() {
      return {
        finished: true,
        events: events_storage.as_list(),
        me: me.as_object(),
        worker: new Worker('/vector.worker.js'),
        working: false,
        new_poster: null,
        posters: posters_storage.as_list(),
        storage: firebase.storage().ref()
      }
    },
    async created() {
      console.info(`${this.me.first_name} viewed their posters`)
      firebase.auth().onAuthStateChanged(this.sync_posters_with_network)
      this.worker.addEventListener('message', this.brand_new_poster)
    },
    computed: {
      as_itemid() {
        return `posters/${this.new_poster.created_at}`
      }
    },
    methods: {
      newer_first(earlier, later) {
        return later.created_at - earlier.created_at
      },
      get_id(poster_reference) {
        return `posters/${poster_reference.name.split('.')[0]}`
      },
      async vectorize_image(image) {
        this.working = true
        this.worker.postMessage({ image })
      },
      async sync_posters_with_network(user) {
        if (user) {
          const posters_directory = await posters_storage.directory()
          // remove any posters not in the directory
          this.posters = this.posters.filter(poster => {
            return posters_directory.items.some(remote_poster => {
              return poster.id === this.get_id(remote_poster)
            })
          })
          // add any posters not in the list
          const put_me_in_coach = posters_directory.items.filter(poster_reference => {
            return !this.posters.some(local_poster => {
              return local_poster.id === this.get_id(poster_reference)
            })
          })
          put_me_in_coach.forEach(async (poster_reference) => {
            const url = await this.storage.child(poster_reference.fullPath).getDownloadURL()
            const items_as_text = await (await fetch(url)).text()
            const poster_object = Item.get_first_item(items_as_text)
            this.posters.push(poster_object)
            this.posters.sort(this.newer_first)
          })
        }
      },
      brand_new_poster(event) {
        console.info(`${this.me.first_name} created a poster`)
        this.new_poster = event.data
        this.new_poster.type = '/posters'
        this.new_poster.id = this.as_itemid
        this.working = false
      },
      remove_new_poster() {
        this.working = true
        this.new_poster = null
        this.working = false
      },
      async add_poster() {
        console.info(`${this.me.first_name} saved poster`)
        this.working = true
        posters_storage.filename = this.as_itemid
        this.posters.unshift(this.new_poster)
        this.new_poster = null
        await this.$nextTick()
        await posters_storage.save()
        this.working = false
      },
      async remove_poster(poster_id) {
        this.working = true
        this.posters = this.posters.filter(poster => poster_id !== poster.id)
        await this.$nextTick()
        await this.remove_event(poster_id)
        posters_storage.filename = poster_id
        await posters_storage.delete()
        this.working = false
      },
      async add_event(event) {
        this.events.push(event)
        await this.$nextTick()
        events_storage.save(this.$refs.events)
      },
      async remove_event(poster_id) {
        this.events = this.events.filter(event => event.poster !== poster_id)
        await this.$nextTick()
        events_storage.save(this.$refs.events)
      }
    },
    watch: {
      async posters() {
        await this.$nextTick()
        posters_storage.save()
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    & > header
      justify-content: space-between
      margin: auto
      @media (min-width: mid-screen)
        max-width: page-width
      & > a > svg.add
        fill: green
    & > hgroup
      svg.working
        margin-bottom: base-line
      & > h1
        color: green
    & > article[itemprop="posters"]
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-template-rows: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-gap: base-line
      @media (min-width: min-screen)
        padding: 0 base-line
      & > header
        margin auto
</style>
