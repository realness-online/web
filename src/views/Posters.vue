<template>
  <section id="posters" class="page">
    <input type="file" accept="image/jpeg" ref="uploader" v-uploader>
    <header v-show="!new_poster">
      <a @click="select_photo"><icon name="add"></icon></a>
      <logo-as-link></logo-as-link>
    </header>
    <article itemprop="posters">
      <header>
        <h1>Posters</h1>
        <hgroup v-show="!new_poster">
          <icon v-show="working" name="working"></icon>
        </hgroup>
      </header>
      <as-figure v-if="new_poster" class="new"
                 :itemid="as_itemid"
                 :new_poster="new_poster"
                 :working="working"
                 @add-poster="add_poster"
                 @remove-poster="cancel_poster"></as-figure>
      <as-figure v-else v-for="itemid in posters"
                 :itemid="itemid"
                 :key="itemid"
                 :working="working"
                 @remove-poster="remove_poster"></as-figure>
    </article>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import {
    posters_storage,
    person_storage as me
  } from '@/persistance/Storage'
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
    data () {
      return {
        finished: true,
        posters: [],
        me: me.as_object(),
        worker: new Worker('/vector.worker.js'),
        working: false,
        new_poster: null,
        storage: firebase.storage().ref()
      }
    },
    async created () {
      console.info(`${this.me.first_name} views their posters`)
      firebase.auth().onAuthStateChanged(this.get_poster_list)
      this.worker.addEventListener('message', this.brand_new_poster)
    },
    computed: {
      as_itemid () {
        return `${this.me.id}/posters/${this.new_poster.created_at}`
      }
    },
    methods: {
      newer_first (earlier, later) {
        return later.created_at - earlier.created_at
      },
      get_id (poster_reference) {
        return `${this.me.id}/posters/${poster_reference.name.split('.')[0]}`
      },
      async vectorize_image (image) {
        this.working = true
        this.worker.postMessage({ image })
      },
      async get_poster_list (user) {
        if (user) {
          const directory = await posters_storage.directory()
          directory.items.forEach(item => this.posters.push(this.get_id(item)))
        }
      },
      brand_new_poster (event) {
        console.info(`${this.me.first_name} creates a poster`)
        this.new_poster = event.data
        this.new_poster.type = '/posters'
        this.new_poster.id = this.as_itemid
        this.working = false
      },
      async add_poster (itemid) {
        this.working = true
        console.info(`${this.me.first_name} adds a poster`)
        posters_storage.filename = itemid
        this.posters.unshift(itemid)
        await this.$nextTick()
        await posters_storage.save()
        this.new_poster = null
        this.working = false
      },
      async remove_poster (itemid) {
        this.working = true
        this.posters = this.posters.filter(poster => itemid !== poster.id)
        await this.$nextTick()
        await this.remove_event(itemid)
        posters_storage.filename = itemid
        await posters_storage.delete()
        this.working = false
      },
      cancel_poster () {
        this.working = true
        this.new_poster = null
        this.working = false
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    h1
      color: green
      margin: 0
    svg.working
      margin-bottom: base-line
    & > header
      justify-content: space-between
      & > a > svg.add
        fill: green
    & > article[itemprop="posters"]
      display: grid
      grid-gap: base-line
      grid-template-columns: repeat(auto-fit, minmax(poster-min-width, 1fr))
      grid-template-rows: (base-line * 4) repeat(1000, poster-grid-height)
      @media (min-width: pad-begins)
        padding: 0 base-line
      & > header
        @media (min-width: pad-begins)
          grid-column: 1 / -1
        & > h1
          margin: base-line
</style>
