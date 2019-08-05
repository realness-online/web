import post_helper from '@/helpers/post'
import { person_local } from '@/modules/LocalStorage'
import date_formating from '@/mixins/date_formating'
export default {
  mixins: [date_formating],
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
  computed: {
    me() {
      if (person_local.as_object().id === this.person.id) return true
      else return false
    },
    created_time() {
      return this.created_time(this.post.created_at)
    },
    id() {
      return post_helper.as_id(this.post, this.person)
    },
    as_statement() {
      return post_helper.as_statement(this.post)
    },
    i_am_oldest() {
      if (this.post.created_at === this.person.oldest_post) return true
      else {
        if (!this.statements) return false
        return this.post.statements.some(statement => {
          if (statement.created_at === this.person.oldest_post) return true
          else return false
        })
      }
    }
  },
  methods: {
    save() {
      this.$emit('save-posts', this.person)
    },
    as_id(post) {
      return post_helper.as_id(post, this.person)
    },
    as_statement(post) {
      return post_helper.as_statement(post)
    }
  }
}
