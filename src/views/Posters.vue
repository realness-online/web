<template>
  <section id="posters" class="page">
    <header>
      <a v-if="add" @click="select_photo"><icon name="add" /></a>
      <icon v-else name="nothing" />
      <h1>Posters</h1>
      <a v-if="add" id="camera" @click="open_camera"><icon name="camera" /></a>
      <input ref="uploader" v-uploader type="file" accept="image/jpeg,image/png">
      <logo-as-link />
    </header>
    <icon v-if="working" name="working" />
    <article v-else>
      <as-figure v-if="new_poster"
                 class="new"
                 :itemid="as_itemid"
                 :new_poster="new_poster"
                 :working="working"
                 @loaded="optimize">
        <menu>
          <a class="remove" @click="cancel_poster"><icon name="remove" /></a>
          <a v-if="new_poster.id" class="save" @click="save_poster"><icon name="finished" /></a>
        </menu>
      </as-figure>
      <as-figure v-for="poster in posters" v-else
                 :key="poster.id"
                 :itemid="poster.id"
                 :class="{ 'selecting-event': poster.picker }"
                 @vector-click="menu_toggle(poster.id)">
        <event-as-fieldset v-if="poster.picker" :itemid="poster.id" @picker="picker(poster.id)" />
        <menu v-else>
          <a class="remove" @click="remove_poster(poster.id)"><icon name="remove" /></a>
          <event-as-button :itemid="poster.id" @picker="picker(poster.id)" />
          <as-download :itemid="poster.id" />
        </menu>
      </as-figure>
    </article>
    <hgroup v-if="friendly" class="message">
      <p>
        Click the <a @click="select_photo"><icon name="add" /></a> button to
        turn any picture you have into a Poster
      </p>
    </hgroup>
  </section>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/auth'
  import { del } from 'idb-keyval'
  import { as_directory } from '@/helpers/itemid'
  import get_item from '@/modules/item'
  import { recent_item_first } from '@/helpers/sorting'
  import { Poster } from '@/persistance/Storage'
  import icon from '@/components/icon'
  import as_figure from '@/components/posters/as-figure'
  import logo_as_link from '@/components/logo-as-link'
  import event_as_fieldset from '@/components/events/as-fieldset'
  import event_as_button from '@/components/events/as-button'
  import as_download from '@/components/download-vector'
  import uploader from '@/mixins/uploader'
  import signed_in from '@/mixins/signed_in'
  export default {
    components: {
      icon,
      'as-figure': as_figure,
      'logo-as-link': logo_as_link,
      'event-as-fieldset': event_as_fieldset,
      'event-as-button': event_as_button,
      'as-download': as_download
    },
    mixins: [signed_in, uploader],
    data () {
      return {
        finished: true,
        posters: [],
        vectorizer: new Worker('/vector.worker.js'),
        optimizer: new Worker('/optimize.worker.js'),
        working: true,
        new_poster: null,
        events: []
      }
    },
    computed: {
      as_itemid () {
        if (this.new_poster && this.new_poster.id) return this.new_poster.id
        else return `${localStorage.me}/posters/${Date.now()}`
      },
      friendly () {
        if (this.posters.length === 0 && !this.working && !this.new_poster) return true
        else return false
      },
      add () {
        if (this.working || this.new_poster) return false
        else return true
      }
    },
    async created () {
      console.time('view:Posters')
      this.vectorizer.addEventListener('message', this.vectorized)
      this.optimizer.addEventListener('message', this.optimized)
      firebase.auth().onAuthStateChanged(async user => {
        await this.get_poster_list()
        console.timeEnd('view:Posters')
        this.working = false
      })
    },
    destroyed () {
      this.vectorizer.terminate()
      this.optimizer.terminate()
    },
    methods: {
      get_id (name) {
        return `${localStorage.me}/posters/${name}`
      },
      async get_poster_list (user) {
        this.posters = []
        const directory = await as_directory(`${localStorage.me}/posters`)
        if (directory && directory.items) {
          directory.items.forEach(item => {
            this.posters.push({
              id: this.get_id(item),
              menu: false,
              picker: false
            })
          })
        }
        this.posters.sort(recent_item_first)
      },
      vectorize (image) {
        console.time('vectorize')
        this.working = true
        this.vectorizer.postMessage({ image })
      },
      async vectorized (response) {
        this.new_poster = response.data.vector
        this.new_poster.type = 'posters'
        this.new_poster.id = this.as_itemid
        this.working = false
        console.timeEnd('vectorize')
        console.info('create:poster', this.new_poster.id)
      },
      optimize (vector) {
        console.time('optimize')
        this.optimizer.postMessage({ vector })
      },
      optimized (message) {
        this.new_poster = get_item(message.data.vector)
        console.timeEnd('optimize')
      },
      async save_poster () {
        const id = this.new_poster.id
        if (!id) return null
        this.working = true
        const poster = new Poster(id)
        await poster.save()
        await this.$nextTick()
        this.posters.unshift({
          id: id,
          menu: false,
          picker: false
        })
        this.new_poster = null
        this.working = false
        del(`${localStorage.me}/posters/`)
        // Creating a poster during a sync will sometimes
        // create a directory with only the poster you just createed
        console.info('save:poster', id)
      },
      async remove_poster (id) {
        const message = 'Delete poster?'
        if (window.confirm(message)) {
          this.posters = this.posters.filter(item => id !== item.id)
          const poster = new Poster(id)
          await poster.delete()
          console.info('delete:poster', id)
        }
      },
      cancel_poster () {
        this.working = true
        this.new_poster = null
        this.working = false
      },
      menu_toggle (itemid) {
        const poster = this.posters.find(poster => poster.id === itemid)
        poster.menu = !poster.menu
      },
      picker (itemid) {
        const poster = this.posters.find(poster => poster.id === itemid)
        poster.picker = !poster.picker
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    & > header
      justify-content: space-between
      & > h1
        margin-bottom: base-line * 2
        @media (prefers-color-scheme: dark)
          color: green
      a#camera
        position: fixed
        bottom: base-line
        left: s('calc( 50% - %s)', (base-line / 2) )
        z-index: 4
        @media (min-width: typing-begins)
          visibility: hidden
        & > svg
          stroke spin(green, 3deg)
          stroke-width 10px
    & header
      svg, a
        color: green
        fill: green
        stroke spin(green, 33deg)
        stroke-width 1px
    & > article
      padding-bottom: base-line * 3
      standard-grid: gentle
      & > figure.poster
        &.selecting-event
          & > svg:not(.background)
            opacity: 0.1
        & > svg.background
          @media (prefers-color-scheme: dark)
            fill: green
        & > figcaption > menu
          a > svg
            @media (prefers-color-scheme: dark)
              fill: spin(green, 3deg)
              stroke spin(green, 3deg)
              stroke-width 1px
            &.has-event
              fill: spin(green, 66deg)
              stroke spin(green, 3deg)
              stroke-width 1px

          a.remove
            bottom: base-line
            left: base-line
          a.save
            bottom: base-line
            right: base-line
          a.event
            top: base-line
            left: base-line
</style>
