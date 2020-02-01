<template lang="html">
  <figure itemscope itemtype="/posters" :itemid="poster.id">
    <svg @click="menu = !menu" :preserveAspectRatio="aspect_ratio"
         :viewBox="poster.view_box" v-html="poster.path">
    </svg>
    <figcaption>
      <meta itemprop="view_box" :content="poster.view_box">
      <meta itemprop="created_at" :content="poster.created_at">
      <meta itemprop="created_by" :content="author.id">
      <input type="datetime-local" ref="picker">
      <menu v-if="menu">
        <a id="create_event" @click="manage_event">
          <svg viewBox="0 0 150 150" >
            <rect rx="8" opacity="0.91" width="114" height="114" fill="white"/>
            <text x="22" y="77">{{today}}</text>
            <path d="M130.019 110.44H117.56V97.9805C117.56 97.0364 117.185 96.131 116.517 95.4635C115.85 94.7959 114.944 94.4209 114 94.4209C113.056 94.4209 112.151 94.7959 111.483 95.4635C110.816 96.131 110.441 97.0364 110.441 97.9805V110.44H97.9807C97.0367 110.44 96.1313 110.815 95.4637 111.483C94.7962 112.15 94.4211 113.056 94.4211 114C94.4211 114.944 94.7962 115.849 95.4637 116.517C96.1313 117.184 97.0367 117.559 97.9807 117.559H110.441V130.019C110.441 130.963 110.816 131.869 111.483 132.536C112.151 133.204 113.056 133.579 114 133.579C114.944 133.579 115.85 133.204 116.517 132.536C117.185 131.869 117.56 130.963 117.56 130.019V117.559H130.019C130.964 117.559 131.869 117.184 132.536 116.517C133.204 115.849 133.579 114.944 133.579 114C133.579 113.056 133.204 112.15 132.536 111.483C131.869 110.815 130.964 110.44 130.019 110.44V110.44Z" />
            <path d="M88.5442 88.5442C74.4853 102.603 74.4853 125.397 88.5442 139.456C102.603 153.515 125.397 153.515 139.456 139.456C153.515 125.397 153.515 102.603 139.456 88.5442C125.397 74.4853 102.603 74.4853 88.5442 88.5442ZM134.543 134.544C123.198 145.888 104.802 145.889 93.4566 134.544C82.1109 123.198 82.1109 104.803 93.4566 93.4566C104.802 82.1109 123.198 82.1109 134.543 93.4566C145.889 104.803 145.889 123.198 134.543 134.544Z" />
          </svg>
        </a>
        <a @click="delete_me">
          <icon v-if="working" name="working"></icon>
          <icon v-else name="remove"></icon>
        </a>
        <a @click="save" v-if="is_new">
          <icon v-if="accept" name="finished"></icon>
          <icon v-else name="working"></icon>
        </a>
        <download-vector :vector="poster" :author="author"></download-vector>
      </menu>
    </figcaption>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  import download_vector from '@/components/download-vector'
  export default {
    props: {
      poster: {
        type: Object,
        required: true
      },
      author: {
        type: Object,
        required: true
      },
      working: {
        type: Boolean,
        required: false,
        default: false
      },
      is_new: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data() {
      return {
        menu: false,
        accept: true,
        show_event: false
      }
    },
    created() {
      if(this.is_new) this.menu = true
    },
    components: {
      'download-vector': download_vector,
      icon
    },
    computed: {
      aspect_ratio() {
        if (this.menu) return `xMidYMid meet`
        else return `xMidYMid slice`
      },
      today() {
        return new Date().toLocaleString('en-US', { day: 'numeric' })
      }
    },
    methods: {
      manage_event(event) {
        console.log("what up", this.$refs.picker);
        this.$refs.picker.focus()
      },
      delete_me() {
        this.$emit('delete', this.poster.id)
      },
      save() {
        this.$emit('save', this.poster.id)
      }
    }
  }
</script>
<style lang="stylus">
  figure[itemtype="/posters"]
    position: relative
    background: green
    input[type="datetime-local"]
      position:absolute
      z-index: -2
      width: 0
      height: 0
    @media (min-width: min-screen)
      &:first-of-type:not(.new)
        max-width: 50vw
    & > svg
      width: 100%
      height: 100vh
      max-height: page-width
    & > figcaption > menu
      padding: base-line
      margin-top: -(base-line * 4)
      display: flex
      justify-content: space-between
      a
        cursor: pointer
      a#create_event
        display: flex
        flex-direction: column;
        justify-content: center;
        span
          color: red
          z-index: 2
          padding-top: (base-line / 4)
          padding-left: ( base-line / 3)
        svg
          text
            stroke: black
            stroke-width: 0.5px
            font-size: base-line * 2
          rect
            stroke: red
            stroke-width: 2px
      svg
        fill: red
        &.finished
          fill: blue !important
</style>
