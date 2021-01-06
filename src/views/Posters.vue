<template>
  <section id="posters" class="page">
    <header>
      <a v-if="add" @click="select_photo"><icon name="add" /></a>
      <icon v-else name="nothing" />
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
      <as-figure v-if="new_poster" :key="as_itemid"
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
      <as-figure v-for="itemid in posters" v-else
                 :key="itemid"
                 :class="{ 'selecting-event': selecting_event }"
                 :itemid="itemid">
        <event-as-fieldset v-if="date_picker" :itemid="itemid" @picker="event_picker" />
        <menu v-else>
          <a class="remove" @click="remove_poster(itemid)"><icon name="remove" /></a>
          <event-as-button :itemid="itemid" />
          <as-download :itemid="itemid" />
        </menu>
      </as-figure>
    </article>
    <hgroup v-if="friendly" class="message">
      <p>
        Click the <a @click="select_photo"><icon name="add" /></a> button to turn any picture you
        have into a Poster
      </p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import get_item from '@/modules/item'
  import { newer_id_first } from '@/helpers/sorting'
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
        menu: false,
        finished: true,
        posters: [],
        vectorizer: new Worker('/vector.worker.js'),
        optimizer: new Worker('/optimize.worker.js'),
        selecting_event: false,
        working: false,
        new_poster: null,
        events: []
      }
    },
    computed: {
      as_itemid () {
        if (this.new_poster.id) return this.new_poster.id
        else return `${localStorage.me}/posters/${this.new_poster.created_at}`
      },
      friendly () {
        if (this.posters.length === 0 && !this.working && !this.new_poster) return true
        else return false
      },
      add () {
        if (this.working || this.new_poster) return false
        else return true
      },
      date_picker () {
        if ((this.menu || this.selecting_event) && this.new_poster === null) return true
        else return false
      }
    },
    async created () {
      console.clear()
      console.time('posters:load')
      console.info('view:posters')
      this.vectorizer.addEventListener('message', this.vectorized)
      this.optimizer.addEventListener('message', this.optimized)
      await this.get_poster_list()
      console.timeEnd('posters:load')
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
        const directory = await itemid.as_directory(`${localStorage.me}/posters`)
        if (directory) directory.items.forEach(item => this.posters.push(this.get_id(item)))
        this.posters.sort(newer_id_first)
      },
      vectorize (image) {
        console.time('vectorize')
        this.working = true
        this.vectorizer.postMessage({ image })
      },
      async vectorized (response) {
        this.new_poster = response.data
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
        this.posters.unshift(id)
        this.new_poster = null
        this.working = false
        this.menu = false
        console.info('save:poster', id)
      },
      async remove_poster (id) {
        const message = 'Delete poster?'
        if (window.confirm(message)) {
          this.working = true
          this.posters = this.posters.filter(item => id !== item)
          const poster = new Poster(id)
          await poster.delete()
          this.working = false
          console.info('delete:poster', id)
        }
      },
      cancel_poster () {
        this.working = true
        this.new_poster = null
        this.working = false
      },
      event_picker (selecting) {
        if (selecting) {
          this.menu = false
          this.selecting_event = true
        } else {
          this.menu = true
          this.selecting_event = false
        }
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    padding-bottom: base-line
    &.selecting-event
      & > svg:not(.background)
        opacity: 0.1
    hgroup.message > p:first-child a
      border-bottom: 0
    h1
      color: green
      margin: 0 base-line 0 base-line
    & > header
      justify-content: space-between
    & hgroup
      align-self: center
    & hgroup
    & header
      svg, a
        color: green
        fill: green
    figure.poster
      & > svg.background
        fill: green
      & > figcaption > menu
        a > svg
          fill: green
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
