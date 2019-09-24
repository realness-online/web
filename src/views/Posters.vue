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
    <figure itemprop="posters" itemscope itemtype="poster"
            :itemid="itemid(poster)"
            v-for="poster in posters">
            <svg :viewBox="viewport(poster)" v-html="poster.vector"></svg>
    </figure>
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
    methods: {
      viewport(poster){
        return `0 0 ${poster.width} ${poster.height}`
      },
      itemid(poster) {
        return '/{phone_number}/posters/{created_at}.svg'
      },
      async vectorize_image(image) {
        this.working = true
        this.worker.addEventListener('message', event => {
          this.posters.unshift(event.data)
          this.working = false
        })
        this.worker.postMessage({image, width:512})
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    input[type=file]
      display:none
    svg
      fill: green
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
      & > svg
        width: base-line * 2
        height: base-line * 2
      & > a
        -webkit-tap-highlight-color: green
    & > figure[itemprop=posters] svg
      width:100%
      height:100vh

</style>
