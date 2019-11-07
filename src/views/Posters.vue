<template>
  <section id="posters" class="page">
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
    <header>
      <a @click="open_camera"><icon name="camera"></icon></a>
      <icon v-if="working" name="working"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Posters</h1>
    </hgroup>
    <figure itemscope itemtype="/posters" v-if="new_poster" :itemid="as_itemid">
      <svg @click="show_menu = !show_menu">
        <symbol preserveAspectRatio="xMidYMid meet"
                :id="new_poster.created_at"
                :viewBox="new_poster.view_box"
                v-html="new_poster.path"></symbol>
        <use :xlink:href='as_fragment_id'/>
      </svg>
      <figcaption>
        <meta itemprop="view_box" :content="new_poster.view_box">
        <meta itemprop="created_at" :content="new_poster.created_at">
        <menu v-if="show_menu">
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
    <article outline v-else itemprop="posters">
      <as-figure @delete="delete_poster" v-for="poster in posters"
                :working="working" :poster="poster" v-bind:key="poster.id"></as-figure>
    </article>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import 'firebase/storage'
  import Storage from '@/classes/Storage'
  import Item from '@/modules/item'
  import { person_local } from '@/classes/LocalStorage'
  import icon from '@/components/icon'
  import as_figure from '@/components/posters/as-figure'
  import logo_as_link from '@/components/logo-as-link'
  import uploader from '@/mixins/uploader'
  import signed_in from '@/mixins/signed_in'
  import { posters_storage } from '@/classes/LargeStorage'
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
        me: person_local.as_object(),
        worker: new Worker('/vector.worker.js'),
        working: false,
        new_poster: null,
        posters: []
      }
    },
    async created() {
      this.worker.addEventListener('message', event => {
        this.new_poster = event.data
        this.new_poster.id = this.as_itemid
        this.working = false
      })
      firebase.auth().onAuthStateChanged(this.auth)
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
      remove_new_poster() {
        this.new_poster = null
        this.show_menu = true
      },
      async auth(user) {
        if (user) {
          const directory_list = await posters_storage.as_list()
          await directory_list.forEach(async(item) => {
            const url = await firebase.storage().ref().child(item.fullPath).getDownloadURL()
            const item_as_fragment = Storage.hydrate(await (await fetch(url)).text())
            const an_item = Item.get_first_item(item_as_fragment)
            this.posters.push(an_item)
            this.working = false
          })
        }
      },
      async vectorize_image(image) {
        this.working = true
        this.worker.postMessage({ image, width: 512 })
      },
      async delete_poster(poster_id) {
        this.working = true
        posters_storage.filename = poster_id
        await posters_storage.delete()
        this.posters = this.posters.filter(poster => poster_id != poster.id)
        this.working = false
      },
      async save() {
        this.working = true
        posters_storage.filename = this.as_itemid
        this.posters.unshift(this.new_poster)
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
    & > hgroup > h1
        color: green
    figure
      position: relative
      & > svg
        width: 100%
        height: auto
        min-height: 66vh
    & > figure[itemscope]
      margin 0 auto
      max-width: page-width
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
      & > header
        margin auto
    svg
      &.finished
      &.working
      &.camera
        fill: green
      &.remove
        fill: red
      &.camera
        width: (base-line * 3)
        height: (base-line * 3.9) // 1 * 1.3
</style>
