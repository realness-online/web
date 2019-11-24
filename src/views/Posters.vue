<template>
  <section id="posters" class="page">
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
    <header v-show="!new_poster">
      <a @click="open_camera"><icon name="camera"></icon></a>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup v-show="!new_poster">
      <h1>Posters</h1>
      <icon v-show="working" name="working"></icon>
    </hgroup>
    <figure itemscope itemtype="/posters" v-if="new_poster" :itemid="as_itemid">
      <svg>
        <symbol preserveAspectRatio="xMidYMid meet"
                :id="new_poster.created_at"
                :viewBox="new_poster.view_box"
                v-html="new_poster.path"></symbol>
        <use :xlink:href='as_fragment_id'/>
      </svg>
      <figcaption>
        <meta itemprop="view_box" :content="new_poster.view_box">
        <meta itemprop="created_at" :content="new_poster.created_at">
        <menu>
          <a @click="remove_new_poster()">
            <icon name="remove"></icon>
          </a>
          <a id="accept_changes" @click="save()">
            <icon v-if="finished" name="finished"></icon>
            <icon v-else name="working"></icon>
          </a>
        </menu>
      </figcaption>
    </figure>
    <article v-show="!new_poster" itemprop="posters">
      <as-figure @delete="delete_poster" v-for="poster in posters"
                :working="working" :poster="poster" v-bind:key="poster.id"></as-figure>
    </article>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import Storage and { posters_storage, person_storage } from '@/storage/Storage'
  import sorting from '@/modules/sorting'
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
        show_menu: true,
        me: person_storage.as_object(),
        worker: new Worker('/vector.worker.js'),
        working: false,
        new_poster: null,
        posters: []
      }
    },
    async created() {
      this.posters = ( await posters_storage.as_list() )
      this.posters.sort(sorting.newer_first)
      this.worker.addEventListener('message', this.message_from_vector)
      firebase.auth().onAuthStateChanged(this.sync_posters_with_network)
    },
    computed: {
      as_fragment_id() {
        return `#${this.new_poster.created_at}`
      },
      as_itemid() {
        return `posters/${this.new_poster.created_at}.html`
      }
    },
    methods: {
      message_from_vector(event) {
        this.new_poster = event.data
        this.new_poster.id = this.as_itemid
        this.working = false
      },
      remove_new_poster() {
        this.new_poster = null
        this.show_menu = true
      },
      async sync_posters_with_network(user) {
        if (user) {
          const posters = await posters_storage.as_network_list()
          await posters.forEach(async (poster) => {
            const index = this.posters.findIndex(p => (p.id === poster.id))
            if (index > -1) {
              this.posters.splice(index, 1, poster)
            } else this.posters.push(poster)
          })
          this.posters.sort(sorting.newer_first)
        }
      },
      async vectorize_image(image) {
        this.working = true
        this.worker.postMessage({ image, width: 512 })
      },
      async delete_poster(poster_id) {
        this.working = true
        this.posters = this.posters.filter(poster => poster_id != poster.id)
        await this.$nextTick()
        posters_storage.filename = poster_id
        await posters_storage.delete()
        this.working = false
      },
      async save() {
        this.working = true
        posters_storage.filename = this.as_itemid
        this.posters.unshift(this.new_poster)
        await this.$nextTick()
        await posters_storage.save()
        this.new_poster = null
        this.working = false
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    & > input[type=file]
      display:none
    & > header
      justify-content: space-between
      margin: auto
      @media (min-width: mid-screen)
        max-width: page-width
    & > hgroup
      svg.working
        margin-bottom: base-line
      & > h1
        color: green
    figure
      position: relative
      & > svg
        width: 100%
        height: auto
        min-height: 100vh
    & > figure[itemscope]
      margin 0 auto
      & > figcaption > menu
        position: absolute;
        bottom: base-line
        left: base-line
        right: base-line
        display: flex
        justify-content: space-between
        align-items: center
    & > article[itemprop="posters"]
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-template-rows: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-gap: base-line
      @media (min-width: min-screen)
        padding: 0 base-line
      @media (min-width: mid-screen)
        & > figure
          max-width: page-width
      & > header
        margin auto
      & > figure
        & > svg
          min-height: 50vh
        & > figcaption > menu svg
          position: absolute
          top:25%
          left: 25%
          width:50%
          height: 50%
    svg
      &.finished
      &.working
      &.camera
        fill: green
      &.remove
        fill: red
      &.camera
        width: (base-line * 2.6)
        height: (base-line * 2) // 1 * 1.3
</style>
