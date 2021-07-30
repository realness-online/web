import { as_query_id, load_content } from '@/helpers/itemid'
export default {
  data () {
    return {
      vector: null,
      layers_like_fonts: ['thin', 'light', 'regular', 'bold'],
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
    viewbox () {
      if (this.vector) return this.vector.viewbox
      else return '0 0 0 0'
    }
  },
  methods: {
    async load_animation () {
      const animation_id = this.vector.id.replace('posters', 'animations')
      console.log(animation_id)
      return await load_content(animation_id)
    },
    symbol_id (index) {
      return `${as_query_id(this.vector.id)}_${this.layers_like_fonts[index]}`
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
