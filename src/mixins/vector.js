import { as_query_id, load } from '@/helpers/itemid'
export default {
  data () {
    return {
      vector: null,
      layers_like_fonts: ['light', 'regular', 'bold'],
      animation: null
    }
  },
  props: {
    immediate: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  computed: {
    path () {
      // always return a list
      if (this.working || !this.vector) return null
      if (Array.isArray(this.vector.path)) return this.vector.path
      else return [this.vector.path]
    },
    all_id () {
      if (this.vector) return `${as_query_id(this.vector.id)}-all`
      else return 'all'
    },
    all_fragment () {
      return `#${this.all_id()}`
    },
    viewbox () {
      if (this.vector) return this.vector.viewbox
      else return '0 0 0 0'
    }
  },
  methods: {
    async load_animation () {
      if (!this.vector) return
      const animation_id = this.vector.id.replace('posters', 'animations')
      return await load(animation_id)
    },
    symbol_id (index) {
      if (!this.vector) return
      return `${as_query_id(this.vector.id)}-${this.layers_like_fonts[index]}`
    },
    symbol_fragment (index) {
      return `#${this.symbol_id(index)}`
    }
  },
  mounted () {
    if (this.immediate) this.show()
  },
  updated () {
    if (this.immediate) this.show()
  }
}
