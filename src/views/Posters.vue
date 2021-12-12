<template>
  <section id="posters" class="page">
    <header>
      <a v-if="add" tabindex="-1" @click="select_photo"><icon name="add" /></a>
      <icon v-else name="nothing" />
      <h1>Posters</h1>
      <a v-if="add" id="camera" @click="open_camera"><icon name="camera" /></a>
      <input
        ref="uploader"
        v-uploader
        type="file"
        accept="image/jpeg,image/png" />
      <logo-as-link tabindex="-1" />
    </header>
    <icon v-if="working" name="working" />
    <article v-else>
      <as-figure
        v-if="new_poster"
        class="new"
        :itemid="as_itemid"
        :new_poster="new_poster"
        :working="working"
        @loaded="optimize">
        <menu>
          <a class="remove" @click="cancel_poster"><icon name="remove" /></a>
          <a v-if="new_poster.id" class="save" @click="save_poster">
            <icon name="finished" />
          </a>
        </menu>
      </as-figure>
      <as-figure
        v-for="poster in posters"
        v-else
        :key="poster.id"
        :itemid="poster.id"
        :class="{ 'selecting-event': poster.picker }"
        @click="menu_toggle(poster.id)">
        <as-author-menu :poster="poster" />
      </as-figure>
    </article>
  </section>
</template>
<script>
  import { del } from 'idb-keyval'
  import { as_directory } from '@/use/itemid'
  import get_item from '@/use/item'
  import { recent_item_first } from '@/use/sorting'
  import { Poster } from '@/persistance/Storage'
  import icon from '@/components/icon'
  import as_figure from '@/components/posters/as-figure'
  import as_author_menu from '@/components/posters/as-author-menu'
  import logo_as_link from '@/components/logo-as-link'
  import uploader from '@/mixins/uploader'
  import signed_in from '@/mixins/signed_in'
  export default {
    components: {
      icon,
      'as-figure': as_figure,
      'logo-as-link': logo_as_link,
      'as-author-menu': as_author_menu
    },
    mixins: [signed_in, uploader],
    data() {
      return {
        finished: true,
        posters: [],
        vectorizer: new Worker('/vector.worker.js'),
        optimizer: new Worker('/optimize.worker.js'),
        working: false,
        new_poster: null,
        events: []
      }
    },
    computed: {
      as_itemid() {
        if (this.new_poster && this.new_poster.id) return this.new_poster.id
        else return `${localStorage.me}/posters/${Date.now()}`
      },
      friendly() {
        if (this.posters.length === 0 && !this.working && !this.new_poster)
          return true
        else return false
      },
      add() {
        if (this.working || this.new_poster) return false
        else return true
      }
    },
    async created() {
      this.vectorizer.addEventListener('message', this.vectorized)
      this.optimizer.addEventListener('message', this.optimized)
      await this.get_poster_list()
    },
    unmounted() {
      this.vectorizer.terminate()
      this.optimizer.terminate()
    },
    methods: {
      get_id(name) {
        return `${localStorage.me}/posters/${name}`
      },
      async get_poster_list() {
        this.posters = []
        const posters = await as_directory(`${localStorage.me}/posters`)
        const avatars = await as_directory(`${localStorage.me}/avatars`)

        const directory = [...posters.items, ...avatars.items]
        directory.forEach(item => {
          this.posters.push({
            id: this.get_id(item),
            menu: false,
            picker: false
          })
        })

        this.posters.sort(recent_item_first)
      },
      vectorize(image) {
        this.working = true
        this.vectorizer.postMessage({ image })
      },
      async vectorized(response) {
        this.new_poster = response.data.vector
        this.new_poster.type = 'posters'
        this.new_poster.id = this.as_itemid
        this.working = false
      },
      optimize(vector) {
        this.optimizer.postMessage({ vector })
      },
      optimized(message) {
        this.new_poster = get_item(message.data.vector)
      },
      async save_poster() {
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
      async remove_poster(id) {
        const message = 'Delete poster?'
        if (window.confirm(message)) {
          this.posters = this.posters.filter(item => id !== item.id)
          const poster = new Poster(id)
          await poster.delete()
          console.info('delete:poster', id)
        }
      },
      cancel_poster() {
        this.working = true
        this.new_poster = null
        this.working = false
      },
      menu_toggle(itemid) {
        this.posters.forEach(poster => {
          if (poster.menu) poster.menu = false
        })
        const poster = this.posters.find(poster => poster.id === itemid)
        poster.menu = !poster.menu
      },
      picker(itemid) {
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
      @media (prefers-color-scheme: dark)
        & > h1
          color: green
      a#camera
        position: fixed
        bottom: base-line
        left: s('calc( 50% - %s)', (base-line * 1.25) )
        z-index: 4
        @media (min-width: typing-begins)
          visibility: hidden
    & header
      svg, a
        color: green
        fill: green
    & > article
      standard-grid: gentle
      padding-bottom: base-line * 3
      & > figure.poster
        &.selecting-event
          & > svg:not(.background)
            opacity: 0.1
        & > figcaption > menu > a
          &.gear
            top: base-line
            right: base-line
          &.remove
            bottom: base-line
            left: base-line
          &.save
            bottom: base-line
            right: base-line
          &.event
            top: base-line
            left: base-line
          & > svg
            fill: green
</style>
