<template lang="html">
  <li itemscope itemtype='/post'>
    <meta itemprop="created_at" :content="post.created_at">
    <p v-if="me" itemprop="statement" :contenteditable="true" @blur="save">{{as_statement}}</p>
    <p v-else itemprop="statement">{{as_statement}}</p>
  </li>
</template>
<script>
  import post_mixin from '@/mixins/post'
  export default {
    mixins: [post_mixin],
    methods: {
      save(event) {
        this.$emit('save', this.post)
      }
    }
  }
</script>
