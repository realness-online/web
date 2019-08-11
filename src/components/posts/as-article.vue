<template lang="html">
  <article itemscope itemtype='/post' :key="id">
    <time itemprop="created_at" :datetime="post.created_at">{{as_created_time}}</time>
    <p itemprop="statement" :contenteditable="me" @blur="save">{{as_statement}}</p>
    <ol v-if="has_statements">
      <post-as-li v-for="statement in post.statements" :key="statement.id"
        :post="statement"
        :person="person"
        @blur="save"></post-as-li>
    </ol>
  </article>
</template>
<script>
  import post_mixin from '@/mixins/post'
  import date_mixin from '@/mixins/date'
  import intersection_mixin from '@/mixins/intersection'
  import as_li from '@/components/posts/as-li'
  export default {
    mixins: [post_mixin, date_mixin, intersection_mixin],
    components: {
      'post-as-li': as_li
    }
  }
</script>
<style lang="stylus">
  article[itemtype="/post"]
    overflow: hidden
    margin-bottom: base-line
</style>
