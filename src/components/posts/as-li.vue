<template lang="html">
  <li itemscope itemtype='/post' :itemid="id">
    <meta itemprop="created_at" :content="post.created_at">
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
