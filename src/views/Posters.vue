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
            :itemid="itemid(poster)" :key="itemid(poster)"
            v-for="poster in posters" v-html="poster">
    </figure>
  </section>
</template>
<script>
  import Worker from '@/vector.worker'
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
        working: true,
        posters: []
      }
    },
    methods: {
      itemid(poster) {
        return '/{phone_number}/posters/{created_at}.svg'
      },
      async vectorize_image(image) {
        const worker = new Worker()
        worker.addEventListener('message', event => {
          this.posters.push(event.data.image)
        })
        worker.postMessage({
          cmd: 'make_poster',
          image: image
        })
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
</style>
