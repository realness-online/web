import { list, as_directory, as_author } from '@/helpers/itemid'
import { recent_number_first } from '@/helpers/sorting'
export default {
  data () {
    return {
      authors: [],
      shown: false
    }
  },
  methods: {
    async thought_shown (statements) {
      const oldest = statements[statements.length - 1]
      let author = as_author(oldest.id)
      const author_statements = this.statements.filter(statement => author === as_author(statement.id))
      const author_oldest = author_statements[author_statements.length - 1]
      if (oldest.id === author_oldest.id) {
        author = this.authors.find(relation => relation.id === author)
        const directory = await as_directory(`${author.id}/statements`)
        if (!directory) return
        let history = directory.items
        history.sort(recent_number_first)
        history = history.filter(page => !author.viewed.some(viewed => viewed === page))
        const next = history.shift()
        if (next) {
          const next_statements = await list(`${author.id}/statements/${next}`)
          author.viewed.push(next)
          this.statements = [...this.statements, ...next_statements]
        }
      }
    },
    slot_key (item) {
      if (Array.isArray(item)) return item[0].id
      return item.id
    }
  }
}
