<template>
  <figure class="profile" itemscope itemtype='/person' :itemid="item_id">
    <svg @click="avatar_click" class='avatar'>
      <use :xlink:href="avatar"/>
    </svg>
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <p v-if="me" itemprop="mobile" :data-value="person.mobile">{{mobile_display}}</p>
      <a v-else itemprop="mobile" :data-value="person.mobile" :href="sms_link">{{mobile_display}}</a>
      <meta itemprop="created_at" :content="person.created_at">
      <meta itemprop="updated_at" :content="person.updated_at">
    </figcaption>
    <input id="avatar_picker" type="file" accept="image/*" style="display:none"
            v-if="edit_avatar" ref="file_upload" v-uploader>
  </figure>
</template>
<script>
  import { AsYouType } from 'libphonenumber-js'
  import icons from '@/icons.svg'
  export default {
    props: {
      person: Object,
      previous: {
        type: Boolean,
        default: false
      },
      me: {
        type: Boolean,
        default: false
      },
      edit_avatar: {
        type: Boolean,
        default: false
      },
      nav: {
        type: Boolean,
        default: true
      }
    },
    directives: {
      uploader: {
        bind(el, binding, vnode) {
          el.addEventListener('change', e => {
            /* istanbul ignore next */
            if (e.target.files[0] !== undefined) {
              vnode.context.file = e.target.files[0]
            }
          })
        }
      }
    },
    data() {
      return {
        file: ''
      }
    },
    methods: {
      avatar_click(event) {
        let route = {
          path: `/+1${this.person.mobile}`
        }
        if (this.previous) {
          route.path = sessionStorage.previous
        }
        if (this.me) {
          route.path = '/account'
        }
        if (this.edit_avatar) {
          this.$refs.file_upload.click()
        } else {
          this.$router.push(route)
        }
      }
    },
    computed: {
      avatar() {
        return `${icons}#silhouette`
      },
      item_id() {
        return `/+1${this.person.mobile}`
      },
      sms_link() {
        return !!this.person.mobile && `sms:+1${this.person.mobile}`
      },
      mobile_display() {
        return new AsYouType('US').input(this.person.mobile)
      }
    }
  }
</script>
<style lang="stylus">
  @require '../../style/variables'
  figure.profile
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    display:flex
    & > svg
      cursor: pointer
      fill: black
      stroke: lighten(black, 20%)
      stroke-width: (base-line / 36)
      border-radius: base-line
    & > figcaption
      padding-left: (base-line / 2)
      vertical-align: middle
      line-height: (base-line * 2)
      & > p
        color:black
        margin:0
        & > span
          text-transform: capitalize
      & > a
        display:block
</style>
