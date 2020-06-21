<template>
  <section id="posters" class="page">
    <header v-show="!new_poster">
      <a @click="select_photo">
        <icon name="add" />
      </a>
      <input ref="uploader" v-uploader type="file" accept="image/jpeg">
      <logo-as-link />
    </header>
    <article>
      <header>
        <h1>Posters</h1>
        <hgroup v-show="!new_poster">
          <icon v-show="working" name="working" />
        </hgroup>
      </header>
      <as-figure v-if="new_poster" class="new"
                 :itemid="as_itemid"
                 :new_poster="new_poster"
                 :working="working"
                 @add-poster="add_poster"
                 @remove-poster="cancel_poster" />
      <as-figure v-for="itemid in posters" v-else
                 :key="itemid"
                 :itemid="itemid"
                 :working="working"
                 @remove-poster="remove_poster" />
    </article>
    <hgroup v-if="posters.length === 0" class="message">
      <p>
        Click the <a @click="select_photo"><icon name="add" /></a> button to turn any picture you
        have into a Poster
      </p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import itemid from '@/helpers/itemid'
  import { newer_item_first } from '@/helpers/sorting'
  import { Poster } from '@/persistance/Storage'
  import icon from '@/components/icon'
  import as_figure from '@/components/posters/as-figure'
  import logo_as_link from '@/components/logo-as-link'
  import uploader from '@/mixins/uploader'
  import signed_in from '@/mixins/signed_in'
  export default {
    components: {
      icon,
      'as-figure': as_figure,
      'logo-as-link': logo_as_link
    },
    mixins: [signed_in, uploader],
    data () {
      return {
        finished: true,
        posters: [],
        worker: new Worker('/vector.worker.js'),
        working: false,
        new_poster: null,
        storage: firebase.storage().ref()
      }
    },
    computed: {
      as_itemid () {
        return `${this.me}/posters/${this.new_poster.created_at}`
      }
    },
    async created () {
      console.clear()
      console.time('feed-load')
      console.info('views their posters')
      firebase.auth().onAuthStateChanged(this.get_poster_list)
      this.worker.addEventListener('message', this.brand_new_poster)
    },
    methods: {
      get_id (name) {
        return `${this.me}/posters/${name.split('.')[0]}`
      },
      vectorize_image (image) {
        this.working = true
        this.worker.postMessage({ image })
      },
      async get_poster_list (user) {
        if (user) {
          this.posters = []
          const directory = await itemid.as_directory(`/${user.phoneNumber}/posters`)
          if (directory) directory.items.forEach(item => this.posters.push(this.get_id(item)))
          this.posters.sort(newer_item_first)
          console.timeEnd('feed-load')
        }
      },
      brand_new_poster (response) {
        console.info('creates a poster')
        this.new_poster = response.data
        this.new_poster.type = 'posters'
        this.new_poster.id = this.as_itemid
        this.working = false
      },
      async add_poster (id) {
        this.working = true
        console.info(`adds poster ${id}`)
        const poster = new Poster(id)
        await poster.save()
        await this.$nextTick()
        this.posters.unshift(id)
        this.new_poster = null
        this.working = false
      },
      async remove_poster (id) {
        this.working = true
        this.posters = this.posters.filter(item => id !== item)
        const poster = new Poster(id)
        await poster.delete()
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
    padding-bottom: base-line
    hgroup.message > p:first-child a
      border-bottom: 0
    h1
      width: 100vw
      color: green
      margin: 0
    svg.working
      margin-bottom: base-line
    & > header
      justify-content: space-between
    & hgroup
      margin-top: base-line
      align-self: center
    & hgroup
    & header
      svg, a
        color: green
        fill: green
</style>
