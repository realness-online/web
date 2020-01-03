import post_helper from '@/helpers/post'
import date_helper from '@/helpers/date'
import { person_storage as me } from '@/persistance/Storage'
export default {
  props: {
    post: {
      type: Object,
      required: true
    },
    person: {
      type: Object,
      required: true
    },
    editable: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    me() {
      if (this.editable && me.as_object().id === this.person.id) return true
      else return false
    },
    as_created_time() {
      return date_helper.as_time(this.post.created_at)
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
        if (!this.post.statements) return false
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
    as_statement_from_post(post) {
      return post_helper.as_statement(post)
    }
  }
}
