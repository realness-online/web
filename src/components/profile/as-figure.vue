<template>
  <figure class="profile" itemscope itemtype='/person' :itemid="item_id">
    <input id="avatar_picker" type="file" accept="image/*" style="display:none"
            v-if="edit_avatar" ref="file_upload" v-uploader>
    <img v-if="has_upload" :src="avatar" >
    <svg v-else @click="avatar_click" class='avatar'>
      <use :xlink:href="avatar"/>
    </svg>
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <p v-if="me" itemprop="mobile" :data-value="person.mobile">{{mobile_display}}</p>
      <a v-else itemprop="mobile" :data-value="person.mobile" :href="sms_link">{{mobile_display}}</a>
      <meta itemprop="has_avatar" :content="person.has_avatar">
      <meta itemprop="created_at" :content="person.created_at">
      <meta itemprop="updated_at" :content="person.updated_at">
    </figcaption>
  </figure>
</template>
<script>
  import Vue from 'vue'
  import { AsYouType } from 'libphonenumber-js'
  import icons from '@/icons.svg'
  import {person_storage, avatar_storage} from '@/modules/Storage'
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
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
    data() {
      return {
        avatar: `${icons}#silhouette`,
        has_upload: false
      }
    },
    created() {
      console.log('inside me')
      const storage = firebase.storage().ref()
      const svg = storage.child(`/people/+1${this.person.mobile}/avatar.svg`)
      svg.getDownloadURL().then(url => {
        console.log('Found svg', url)
        this.has_upload = true
        this.avatar = url
      }).catch(error => {
        const jpg = storage.child(`/people/+1${this.person.mobile}/avatar.jpg`)
        console.log(error.message, 'attempting jpg')
        jpg.getDownloadURL().then(url => {
          console.log('Found jpg')
          this.has_upload = true
          this.avatar = url
        })
      })
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
      item_id() {
        return `/+1${this.person.mobile}`
      },
      sms_link() {
        return !!this.person.mobile && `sms:+1${this.person.mobile}`
      },
      mobile_display() {
        return new AsYouType('US').input(this.person.mobile)
      }
    },
    directives: {
      uploader: {
        bind(input, binding, vnode) {
          input.addEventListener('change', event => {
            const avatar_image = event.target.files[0]
            if (avatar_image !== undefined) {
              if (avatar_image.type === 'image/jpeg') {
                avatar_storage.persist(avatar_image).then(result => {
                  vnode.context.person.has_avatar = true
                  Vue.nextTick(() => person_storage.save())
                })
              }
              vnode.context.file = avatar_image
            }
          })
        }
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
    & > img
      border-radius: base-line
      width: base-line * 2
      height: base-line * 2
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
