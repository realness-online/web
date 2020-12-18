<template>
  <section id="posters" class="page">
    <header>
      <a v-if="add" @click="select_photo">
        <icon name="add" />
      </a>
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
      <as-figure v-if="new_poster" class="new"
                 :itemid="as_itemid"
                 :new_poster="new_poster"
                 :working="working"
                 @add-poster="save_poster"
                 @remove-poster="cancel_poster"
                 @loaded="optimize" />
      <as-figure v-for="itemid in posters" v-else
                 :key="itemid"
                 :itemid="itemid"
                 @remove-poster="remove_poster" />
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
        vectorizer: new Worker('/vector.worker.js'),
        optimizer: new Worker('/optimize.worker.js'),
        working: false,
        new_poster: null
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
      }
    },
    async created () {
      console.clear()
      console.time('posters-load')
      console.info('view:posters')
      this.vectorizer.addEventListener('message', this.vectorized)
      this.optimizer.addEventListener('message', this.optimized)
      await this.get_poster_list()
      console.timeEnd('posters-load')
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
        console.timeEnd('vectorize')
        console.info('create:poster', this.new_poster.id)
      },
      optimize (vector) {
        console.time('optimize')
        this.optimizer.postMessage({ vector })
      },
      optimized (message) {
        this.new_poster = get_item(message.data.vector)
        this.working = false
        console.timeEnd('optimize')
      },
      async save_poster (id) {
        this.working = true
        const poster = new Poster(id)
        await poster.save()
        await this.$nextTick()
        this.posters.unshift(id)
        this.new_poster = null
        this.working = false
        console.info('save:poster', id)
      },
      async remove_poster (id) {
        this.working = true
        this.posters = this.posters.filter(item => id !== item)
        const poster = new Poster(id)
        await poster.delete()
        this.working = false
        console.info('delete:poster', id)
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
</style>
