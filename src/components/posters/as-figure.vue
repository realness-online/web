<template lang="html">
  <figure itemscope itemtype="/posters" :itemid="poster.id" >
    <svg @click="menu = !menu" preserveAspectRatio="xMidYMid meet"
         :viewBox="poster.view_box" v-html="poster.path">
    </svg>
    <figcaption>
      <meta itemprop="view_box" :content="poster.view_box">
      <meta itemprop="created_at" :content="poster.created_at">
      <menu v-if="menu">
        <a @click="delete_me">
          <icon v-if="working" name="working"></icon>
          <icon v-else name="remove"></icon>
        </a>
      </menu>
    </figcaption>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  export default {
    props: ['poster', 'working'],
    data() {
      return {
        menu: false
      }
    },
    components: {
      icon
    },
    methods: {
      async delete_me() {
        this.$emit('delete', this.poster.id)
      }
    }
  }
</script>
<style lang="stylus">
</style>
