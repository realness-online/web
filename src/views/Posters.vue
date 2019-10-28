<template>
  <section id="posters" class="page">
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
    <header>
      <a @click="select_photo"><icon name="add"></icon></a>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Posters</h1>
      <icon v-if="working" name="working"></icon>
      <menu v-else>
        <a @click="open_camera"><icon name="camera"></icon></a>
      </menu>
    </hgroup>
    <figure v-if="new_poster" itemscope itemtype="/posters" :itemid="itemid(new_poster)">
      <svg xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMin meet">
        <symbol :id="new_poster.created_at" :viewBox="new_poster.view_box" v-html="new_poster.path"></symbol>
        <use :xlink:href='as_fragment_id(new_poster)'/>
      </svg>
      <figcaption>
        <meta itemprop="view_box" :content="new_poster.view_box">
        <meta itemprop="created_at" :content="new_poster.created_at">
        <menu>
          <a id="accept_changes" @click="save(new_poster)">
            <icon v-if="finished" name="finished"></icon>
            <icon v-else name="working"></icon>
          </a>
        </menu>
      </figcaption>
    </figure>
    <article itemprop="posters">
      <figure v-for="poster in posters">
        <svg itemscope itemtype="/posters" preserveAspectRatio="xMidYMin slice"
             :itemid="poster.id" :viewBox="poster.view_box" v-html="poster.path">
        </svg>
        <figcaption>
          <meta itemprop="view_box" :content="poster.view_box">
          <meta itemprop="created_at" :content="poster.created_at">
          <menu><a @click="delete_poster(poster.id)"><icon name="remove"></icon></a></menu>
        </figcaption>
      </figure>
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
  import logoAsLink from '@/components/logo-as-link'
  import uploader from '@/mixins/uploader'
  import signed_in from '@/mixins/signed_in'
  import LargeStorage, {posters_storage} from '@/classes/LargeStorage'
  export default {
    mixins: [signed_in, uploader],
    components: {
      logoAsLink,
      icon
    },
    data() {
      return {
        finished: true,
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
        this.working = false
      })
      const directory_list =  await posters_storage.as_list()
      await directory_list.forEach(async(item) => {
        const url = await firebase.storage().ref().child(item.fullPath).getDownloadURL()
        const item_as_fragment = Storage.hydrate(await (await fetch(url)).text())
        const an_item = Item.get_first_item(item_as_fragment)
        this.posters.push(an_item)
        this.working = false
      })

    },
    methods: {
      async vectorize_image(image) {
        this.working = true
        this.worker.postMessage({ image, width: 512 })
      },
      itemid(poster) {
        return `/posters/${poster.created_at}`
      },
      as_fragment_id(poster){
        return `#${poster.created_at}`
      },
      async delete_poster(itemid) {
        poster = new LargeStorage('posters', `[itemid="${location}"]`)
        await poster.delete()
      },
      async save(item) {
        const location = this.itemid(item)
        const poster = new LargeStorage('posters', `[itemid="${location}"]`)
        await poster.save()
        this.posters.push(this.new_poster)
        this.posters.sort()
        this.new_poster = null
        await this.$nextTick()
        const items = document.querySelector('[itemprop="posters"]')
        localStorage.setItem(poster.filename, items.outerHTML)
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    input[type=file]
      display:none
    svg.remove
      fill: red
    svg.working
      fill: green
      margin-bottom: base-line
    svg.camera
      display:none
      @media (max-width: min-screen)
        display:block
        width: 100vw
        height: 50vh
    h1
      color: green
    & > header
      margin: auto
      @media (min-width: mid-screen)
        max-width: page-width
      & > a
        -webkit-tap-highlight-color: green
        & > svg
          fill: green
    & > article[itemprop="posters"]
      padding: 0 base-line
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-gap: base-line


      & > figure > svg
        display: block
        width:100%
        min-height: 66vh
</style>
