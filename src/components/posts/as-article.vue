<template lang="html">
  <article itemscope itemtype='/post' :itemid="id" :key="id">
    <time itemprop="created_at" :datetime="post.created_at">{{created_time}}</time>
    <p itemprop="statement" :contenteditable="me" @blur="save">{{as_statement}}</p>
    <ol v-if="post.statements">
      <post-as-li v-for="statement in post.statements" :key="as_id(statement)"
        :post="statement"
        :person="person"
        @end-of-page="next_page"
        @saved="save":></post-as-li>
    </ol>
  </article>
</template>
<script>
  import posts_into_days from '@/mixins/posts_into_days'
  import date_formating from '@/mixins/date_formating'
  import profile_as_avatar from '@/components/profile/as-avatar'
  import post_helper from '@/helpers/post'
  export default {
    mixins: [date_formating, posts_into_days],
    components: {
      'profile-as-avatar': profile_as_avatar
    },
    props: {
      post: {
        type: Object,
        required: true
      },
      person: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        observer: null
      }
    },
    mounted() {
      if (this.i_am_oldest) {
        this.observer = new IntersectionObserver(this.end_of_articles, {})
        this.$nextTick(_ => this.observer.observe(this.$el))
      }
    },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
    },
    computed: {
      me() {
        if (person_local.as_object().id === this.person.id) return true
        else return false
      },
      created_time() {
        return created_time(post.created_at)
      },
      id() {
        return post_helper.as_id(this.post, this.person)
      },
      as_statement() {
        return post_helper.as_statement(this.post)
      },
      i_am_oldest() {
        if (this.post.created_at === this.person.oldest_post) return true
        else false
      }
    },
    methods: {
      as_id(statement) {
        return post_helper.as_id(statement, this.person)
      },
      save() {
        this.$emit('save-posts', this.person)
      },
      next_page(event){
        this.$emit('end-of-page', this.person)
      },
      end_of_articles(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.$emit('end-of-page', this.person)
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
