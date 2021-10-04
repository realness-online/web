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
      if (this.vector) return as_query_id(this.vector.id)
      else return 'new-poster'
    },
    all_fragment () {
      return `#${this.all_id}`
    },
    viewbox () {
      if (this.vector) return this.vector.viewbox
      else return '0 0 16 16' // this is the viewbox for silhouette
    }
  },
  methods: {
    change_color (id, type = 'fill') {
      const symbols = this.$el.querySelectorAll('symbol')
      symbols.forEach(symbol => {
        const symbol_id = symbol.getAttribute('id')
        if (id === symbol_id) {
          const path = symbol.querySelector('path')
          path.setAttribute('fill', this.color)
          this.$emit(`change-${type}`)
          path.focus()
        }
      })
    },
    change_opacity (direction = 'up', type = 'fill', resolution = 0.025) {
      if (!document.activeElement) return
      let fragment = document.activeElement.getAttribute('href')
      fragment = fragment.substring(1)
      const symbols = this.$el.querySelectorAll('symbol')
      symbols.forEach(symbol => {
        const id = symbol.getAttribute('id')
        if (id === fragment) {
          const path = symbol.querySelector('path')
          let opacity = path.getAttribute(`${type}-opacity`)

          if (!opacity || opacity === 'NaN') opacity = 0.5
          opacity = parseFloat(opacity)
          opacity = opacity * 10000
          opacity = Math.round(opacity)
          opacity = opacity / 10000

          if (direction === 'down') opacity += resolution
          else opacity -= resolution

          if (opacity > 0.9) opacity = 0.8
          else if (opacity < 0) opacity = 0.025

          path.setAttribute(`${type}-opacity`, opacity)
          this.$emit('change-opacity')
        }
      })
    },
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
