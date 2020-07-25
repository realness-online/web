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
                 @add-poster="add_poster"
                 @remove-poster="cancel_poster" />
      <as-figure v-for="itemid in posters" v-else
                 :key="itemid"
                 :itemid="itemid"
                 :working="working"
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
  import { newer_date_first } from '@/helpers/sorting'
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
        new_poster: null
      }
    },
    computed: {
      as_itemid () {
        return `${this.me}/posters/${this.new_poster.created_at}`
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
      console.info('views their posters')
      await this.get_poster_list()
      this.worker.addEventListener('message', this.brand_new_poster)
      console.timeEnd('posters-load')
    },
    destroyed () {
      this.worker.terminate()
    },
    methods: {
      get_id (name) {
        return `${this.me}/posters/${name}`
      },
      vectorize_image (image) {
        this.working = true
        this.worker.postMessage({ image })
      },
      async get_poster_list (user) {
        this.posters = []
        const directory = await itemid.as_directory(`${this.me}/posters`)
        if (directory) directory.items.forEach(item => this.posters.push(this.get_id(item)))
        this.posters.sort(newer_date_first)
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
