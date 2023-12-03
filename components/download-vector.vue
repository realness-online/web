<template>
  <a
    v-if="rasterize"
    ref="png"
    class="download"
    :href="content"
    :download="file_name"
    type="image/png"
    @click="download_png">
    <icon name="download" :class="{ working }" />
    <canvas ref="canvas" :width="width" :height="height" hidden></canvas>
  </a>
  <a
    v-else
    :href="content"
    :download="file_name"
    class="download"
    @click="download_svg">
    <icon name="download" />
  </a>
</template>
<script>
  import { as_day_and_time } from '@/use/date'
  import hsl_to_hex from 'hsl-to-hex'
  import { hsla_to_color } from '@/use/colors'
  import { load, as_query_id } from '@/use/itemid'
  import { is_vector_id } from '@/use/vector'
  import icon from '@/components/icon'
  export default {
    components: { icon },
    props: {
      itemid: {
        type: String,
        required: true,
        validator: is_vector_id
      }
    },
    data() {
      return {
        working: false,
        default_size: 16384,
        content: null,
        file_type: 'svg',
        vector: {},
        file_name: null
      }
    },
    computed: {
      width() {
        return this.vector.width * 8
      },
      height() {
        return this.vector.height * 8
      },
      rasterize() {
        return !!localStorage.rasterize
      }
    },
    async mounted() {
      if (this.rasterize) this.file_type = 'png'
      this.file_name = await this.get_vector_name()
    },
    methods: {
      async download_png() {
        console.log('download_png')
        if (this.working || this.content) return
        this.working = true
        this.file_type = 'png'
        this.vector = await load(this.itemid)
        const svg = new XMLSerializer().serializeToString(
          document.getElementById(as_query_id(this.itemid))
        )
        if (!svg) return
        const canvas = this.$refs.canvas
        const context = canvas.getContext('2d')
        const DOMURL = self.URL || self.webkitURL || self
        var img = new Image()
        const svg_blob = new Blob([svg], {
          type: 'image/svg+xml;charset=utf-8'
        })
        var url = DOMURL.createObjectURL(svg_blob)
        this.content = url
        img.onload = async () => {
          context.drawImage(img, 0, 0, this.width, this.height)
          var png = canvas.toDataURL('image/png')
          this.content = png
          await this.$nextTick()
          DOMURL.revokeObjectURL(png)
          await this.$nextTick()
          this.$refs.png.click()
          this.working = false
        }
        img.src = url
      },
      download_svg() {
        this.working = false
        const svg = document.getElementById(as_query_id(this.itemid))
        if (!svg) return
        if (localStorage.adobe) this.adobe(svg)
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        this.content = `data:application/octet-stream,${encodeURIComponent(
          svg.outerHTML
        )}`
      },
      adobe(svg) {
        const convert = svg.querySelectorAll('[stop-color]')
        convert.forEach(element => {
          const hsla = element.getAttribute('stop-color')
          const c = hsla_to_color(hsla)
          element.setAttribute('stop-color', hsl_to_hex(c.h, c.s, c.l))
        })
      },
      async get_vector_name() {
        const info = this.itemid.split('/')
        const author_id = `/${info[1]}`
        const time = as_day_and_time(Number(info[3]))
        const creator = await load(author_id)
        const facts = `${time}.${this.file_type}`
        if (creator)
          return `${creator.first_name}_${creator.last_name}_${facts}`
        else return facts
      }
    }
  }
</script>
<style lang="stylus">
  a.download.working
    animation-name: working
</style>
