<template>
  <icon v-if="working" name="download" />
  <a :href="content" :download="file_name" class="download" @click="download">
    <icon name="download" />
  </a>
  <aside v-if="rasterize" hidden>
    <canvas ref="canvas" :width="width" :height="height"></canvas>
  </aside>
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
        working: true,
        default_size: 16384,
        content: '',
        file_type: 'svg',
        vector: {},
        png: null,
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
      if (this.rasterize) await this.prepare_png()
      this.file_name = await this.get_vector_name()
    },
    methods: {
      download() {
        if (this.rasterize) this.file_type = 'png'
        else this.download_svg()
      },
      async prepare_png() {
        this.file_type = 'png'
        this.vector = await load(this.itemid)
        console.log('preparing png', this.vector)

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
          console.log(this.width)
          console.log(this.height)
          context.drawImage(img, 0, 0, this.width, this.height)
          var png = canvas.toDataURL('image/png')
          this.content = png
          await this.$nextTick()
          DOMURL.revokeObjectURL(png)
        }
        img.src = url
        await this.$nextTick()
        console.log('png prepaired')
      },
      download_svg() {
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
