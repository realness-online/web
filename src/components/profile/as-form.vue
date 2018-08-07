<template lang="html">
  <form id="profile-form">
    <fieldset id="name">
      <input id="first-name" type='text' placeholder="First" required
             v-model="person.first_name">
      <input id="last-name" type='text' placeholder="Last" required
             v-model="person.last_name">
    </fieldset>
    <fieldset id="phone">
      <label for="mobile">1+</label>
      <input id="mobile" type="tel" placeholder="(555) 555-5555"
             v-model="person.mobile"
             v-on:keypress="mobile_keypress"
             v-on:paste="mobile_paste">
      <input id="verification-code" type="tel" placeholder="Verification code"
             v-if="show_code"
             v-model="code"
             v-on:keypress="code_keypress" >
      <div id="captcha"
           v-if='show_captcha'
           v-bind:class="{hide_captcha}">
      </div>
    </fieldset>
    <icon v-show="working" name="working"></icon>
    <menu v-if="valid_mobile_number">
      <button id="authorize"
              v-if="show_authorize"
              v-on:click='begin_authorization'>enter realness</button>
      <button id='submit-verification' disabled
              v-if="show_code"
              v-on:click="sign_in_with_code">sign in</button>
      <button id="sign-out"
              v-if="show_sign_out"
              v-on:click="sign_out">sign out</button>
    </menu>
  </form>
</template>
<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import {parseNumber} from 'libphonenumber-js'
  import {person_storage} from '@/modules/Storage'
  import icon from '@/components/icon'
  export default {
    props: ['person'],
    components: {
      icon
    },
    data() {
      return {
        working: true,
        storage: person_storage,
        code: null,
        human: null,
        authorizer: null,
        show_sign_out: false,
        show_authorize: false,
        show_captcha: false,
        hide_captcha: false,
        show_code: false
      }
    },
    created() {
      firebase.auth().onAuthStateChanged(user => {
        this.working = false
        if (user) {
          this.show_sign_out = true
          this.$bus.$emit('signed-in')
          this.disable_input()
        } else {
          this.show_authorize = true
        }
      })
    },
    computed: {
      valid_mobile_number() {
        return !!this.person.mobile && parseNumber(this.person.mobile, 'US').phone
      },
      mobile_as_e164() {
        return `+1${this.person.mobile}`
      }
    },
    methods: {
      disable_input() {
        this.$el.querySelector('#mobile').disabled = true
        this.$el.querySelector('#first-name').disabled = true
        this.$el.querySelector('#last-name').disabled = true
      },
      save_person() {
        if (!this.person.created_at) {
          this.person.created_at = new Date().toISOString()
          this.person.updated_at = this.person.created_at
        } else {
          this.person.updated_at = new Date().toISOString()
        }
        Vue.nextTick(() => {
          this.storage.save()
        })
      },
      begin_authorization(event) {
        this.working = true
        this.disable_input()
        event.preventDefault()
        this.show_authorize = false
        this.show_captcha = true
        /* istanbul ignore next */
        Vue.nextTick(() => {
          this.human = new firebase.auth.RecaptchaVerifier('captcha', {
            'size': 'invisible',
            'badge': 'inline',
            'callback': this.text_human_verify_code
          })
          this.human.verify()
        })
      },
      text_human_verify_code(response) {
        this.working = false
        this.show_code = true
        this.hide_captcha = true
        firebase.auth()
          .signInWithPhoneNumber(this.mobile_as_e164, this.human)
          .then(result => {
            this.authorizer = result
            this.$el.querySelector('#verification-code').scrollIntoView(false)
            this.$el.querySelector('#verification-code').focus()
          })
      },
      sign_in_with_code(event) {
        this.working = true
        event.preventDefault()
        this.disable_input()
        this.show_code = false
        this.authorizer.confirm(this.code).then(result => {
          this.working = false
          this.show_sign_out = true
          Vue.nextTick(() => this.storage.save())
        })
      },
      sign_out(event) {
        event.preventDefault()
        this.show_sign_out = false
        firebase.auth().signOut()
        this.show_authorize = true
        this.$el.querySelector('#mobile').disabled = false
        this.$el.querySelector('#first-name').disabled = false
        this.$el.querySelector('#last-name').disabled = false
      },
      mobile_keypress(event) {
        if (!event.key.match(/^\d$/)) {
          event.preventDefault()
        }
      },
      mobile_paste(event) {
        event.preventDefault()
        let paste = (event.clipboardData).getData('text')
        this.person.mobile = parseNumber(paste, 'US').phone
      },
      code_keypress(event) {
        if (!event.key.match(/^\d$/)) {
          event.preventDefault()
        }
        let button = this.$el.querySelector('#submit-verification')
        let input = this.$el.querySelector('#verification-code')
        if (input.value.length === 5) { // after this keypress it will be 6
          button.disabled = false
        }
      }
    }
  }
</script>
<style lang="stylus">
  @require '../../style/variables'
  form#profile-form
    div#captcha
      margin-top: base-line
      &.hide_captcha
        display: none
    & > fieldset
      margin-bottom: base-line
    input
      color: red
      &:focus
        outline:0
        &::placeholder
          color:lighten(black, 30%)
      &::placeholder
        color: lighten(black, 30%)
    label[for=mobile]
      margin-right: -0.3em
    input#first-name
      width:40%
      margin-right: base-line
    input#last-name
      width:40%
    input#mobile
      min-width: (40% - base-line * 2)
      margin-right: base-line
    input#verification-code
      margin-top: (base-line / 2)
    
</style>
