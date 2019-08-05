<template lang="html">
  <li itemscope itemtype='/post' :itemid="id">
    <meta itemprop="muted" v-if="post.muted" :content="post.muted">
    <time itemprop="created_at" :datetime="post.created_at">{{as_created_time}}</time>
    <p itemprop="statement" :contenteditable="me" @blur="save_me">{{as_statement}}</p>
  </li>
</template>
<script>
  import post_mixin from '@/mixins/post'
  export default {
    mixins: [post_mixin],
    methods: {
      save_me(event) {
        this.$emit('save', this.post)
      }
    }
  }
</script>
