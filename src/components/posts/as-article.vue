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
  import as_li from '@/components/posts/as-li'
  export default {
    mixins: [post_mixin, date_mixin],
    components: {
      'post-as-li': as_li
    },
    data() {
      return {
        observer: null
      }
    },
    mounted() {
      if (this.i_am_oldest) {
        this.observer = new IntersectionObserver(this.end_of_articles, {
          rootMargin: '0px 0px 256px 0px'
        })
        this.$nextTick(_ => this.observer.observe(this.$el))
      }
    },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
    },
    methods: {
      end_of_articles(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.$emit('end-of-articles', this.person)
            this.observer.unobserve(this.$el)
          }
        })
      }
    }
  }
</script>
<style lang="stylus">
  article[itemtype="/post"]
    overflow: hidden
    margin-bottom: base-line
</style>
