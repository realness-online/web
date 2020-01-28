<template lang="html">
  <figure itemscope itemtype="/posters" :itemid="poster.id">
    <svg @click="menu = !menu" :preserveAspectRatio="aspect_ratio"
         :viewBox="poster.view_box" v-html="poster.path">
    </svg>
    <figcaption>
      <meta itemprop="view_box" :content="poster.view_box">
      <meta itemprop="created_at" :content="poster.created_at">
      <meta itemprop="created_by" :content="author.id">
      <menu v-if="menu">
        <a id="create_event" @click="create_event">
          <span>{{today}}</span>
          <icon name="create-event"></icon>
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
        accept: true
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
    @media (min-width: min-screen)
      &:first-of-type:not(.new)
        max-width: 50vw
    & > svg
      width: 100%
      height: 100vh
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
        position: absolute
        top: base-line
        left: base-line
        & > span
          color: red
          z-index: 1
          padding-top: (base-line / 4)
          padding-left: ( base-line / 3)
        & > svg
          z-index: 0
          position: absolute;
          top: 0
          fill: red
          stroke: black
          stroke-width: 1px
      svg
        fill: red
        &.finished
          fill: blue !important
</style>
