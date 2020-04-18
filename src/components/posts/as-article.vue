<template lang="html">
  <article itemscope itemtype='/posts' :key="id" :itemid="id">
    <header>
      <time itemprop="created_at" :datetime="post.created_at">{{as_created_time}}</time>
    </header>
    <p v-if="me" itemprop="statement" :contenteditable="editable" @blur="save">{{as_statement}}</p>
    <p v-else itemprop="statement">{{as_statement}}</p>
    <ol>
      <post-as-li v-for="statement in post.statements" :key="statement.id"
        :post="statement"
        :person="person"
        @blur="save" :contenteditable="editable"></post-as-li>
    </ol>
  </article>
</template>
<script>
  import post_mixin from '@/mixins/post'
  import date_mixin from '@/mixins/date'
  import post_intersection from '@/mixins/post_intersection'
  import as_li from '@/components/posts/as-li'
  export default {
    mixins: [post_mixin, date_mixin, post_intersection],
    components: {
      'post-as-li': as_li
    },
    methods: {
      save (event) {
        this.$emit('modified', this.post)
      }
    }
  }
</script>
<style lang='stylus'>
  article[itemtype="/posts"]
    overflow: hidden
    & > header
      margin-bottom: (base-line / 2)
</style>
