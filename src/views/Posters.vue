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
    <article>
      <svg itemscope itemtype="/poster" preserveAspectRatio="xMidYMin meet"
           :itemid="itemid(poster)" :viewBox="viewport(poster)"
           v-for="poster in posters" v-html="poster.vector"></svg>
    </article>
  </section>
</template>
<script>
  import icon from '@/components/icon'
  import logoAsLink from '@/components/logo-as-link'
  import uploader from '@/mixins/uploader'
  import signed_in from '@/mixins/signed_in'
  export default {
    mixins: [signed_in, uploader],
    components: {
      logoAsLink,
      icon
    },
    data() {
      return {
        worker: new Worker('/vector.worker.js'),
        working: false,
        posters: []
      }
    },
    created() {
      this.worker.addEventListener('message', event => {
        this.posters.unshift(event.data)
        this.working = false
      })
    },
    methods: {
      viewport(poster) {
        return `0 0 ${poster.width} ${poster.height}`
      },
      itemid(poster) {
        return '/{phone_number}/posters/{created_at}.svg'
      },
      async vectorize_image(image) {
        this.working = true
        this.worker.postMessage({ image, width: 512 })
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    input[type=file]
      display:none
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
    & > article
      padding: 0 base-line
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-gap: base-line
      & > svg
        display: block
        width:100%
        min-height: 66vh
</style>
