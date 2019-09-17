<template lang="html">
  <form id="profile-form">
    <fieldset id="name">
      <input id="first-name" type='text' tabindex="1" placeholder="First" required
             v-model="person.first_name"
             v-on:blur="modified_check">
      <input id="last-name" type='text' tabindex="2"  placeholder="Last" required
             v-model="person.last_name"
             v-on:blur="modified_check">
    </fieldset>
    <fieldset id="phone" v-if="!show_sign_out">
      <label for="mobile">1</label>
      <input id="mobile" type="tel" tabindex="3" placeholder="(555) 555-5555"
             v-model="person.mobile"
             v-on:keypress="mobile_keypress"
             v-on:keyup="mobile_keyup"
             v-on:paste.prevent="mobile_paste"
             v-on:blur="modified_check">
    </fieldset>
    <fieldset id="captcha"
         v-if='show_captcha'
         v-bind:class="{hide_captcha}">
    </fieldset>
    <fieldset v-if="show_code">
      <input id="verification-code" type="tel" tabindex="4" placeholder="Verification Code"
             v-model="code"
             v-on:keypress="code_keypress">
    </fieldset>
    <icon v-show="working" name="working"></icon>
    <menu>
      <button id="authorize"
              :disabled="disabled_sign_in"
              v-if="show_authorize"
              v-on:click.prevent='begin_authorization'>Sign in</button>
      <button id='submit-verification'
              v-if="show_code"
              v-on:click.prevent="sign_in_with_code">Sign in</button>
      <button id="sign-out"
              v-if="show_sign_out"
              v-on:click.prevent="sign_out">
              <icon name="remove"></icon>
      </button>
    </menu>
  </form>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import { parseNumber } from 'libphonenumber-js'
  import profile_id from '@/helpers/profile'
  import icon from '@/components/icon'
  import { person_local } from '@/modules/LocalStorage'
  export default {
    props: ['person'],
    components: {
      icon
    },
    data() {
      return {
        working: true,
        disabled_sign_in: true,
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
          this.person.id = profile_id.from_e64(user.phoneNumber)
        } else {
          if (this.person.id) {
            this.person.mobile = profile_id.as_phone_number(this.person.id)
          }
          this.show_authorize = true
        }
        this.validate_mobile_number()
      })
    },
    mounted() {
      firebase.auth().onAuthStateChanged(user => {
        if (user) this.disable_input()
      })
    },
    methods: {
      validate_mobile_number(event) {
        const is_valid = !!this.person.mobile && parseNumber(this.person.mobile, 'US').phone
        if (is_valid) this.disabled_sign_in = false
        else this.disabled_sign_in = true
        return is_valid
      },
      disable_input() {
        const mobile = this.$el.querySelector('#mobile')
        if (mobile) mobile.disabled = true
      },
      modified_check() {
        const me = person_local.as_object()
        let modified = false
        if (me.id !== this.person.id) modified = true
        if (me.first_name !== this.person.first_name) modified = true
        if (me.last_name !== this.person.last_name) modified = true
        if (modified) {
          this.$emit('modified', this.person)
          sessionStorage.removeItem('profile-synced')
          sessionStorage.removeItem('posts-synced')
        }
      },
      async begin_authorization(event) {
        this.working = true
        this.disable_input()
        this.show_authorize = false
        this.show_captcha = true
        await this.$nextTick()
        this.human = new firebase.auth.RecaptchaVerifier('captcha', {
          'size': 'invisible',
          'badge': 'inline',
          'callback': this.text_human_verify_code
        })
        this.human.verify()
      },
      async text_human_verify_code(response) {
        this.working = false
        this.show_code = true
        this.show_captcha = false
        this.hide_captcha = true
        const result = await firebase.auth()
        .signInWithPhoneNumber(`+1${this.person.mobile}`, this.human)
        this.authorizer = result
        this.$el.querySelector('#verification-code').scrollIntoView(false)
        this.$el.querySelector('#verification-code').focus()
      },
      async sign_in_with_code(event) {
        this.working = true
        this.disable_input()
        this.show_code = false
        sessionStorage.removeItem('profile-synced')
        sessionStorage.removeItem('posts-synced')
        await this.authorizer.confirm(this.code)
        this.working = false
        this.show_sign_out = true
      },
      sign_out(event) {
        firebase.auth().signOut()
        this.show_sign_out = false
        this.show_authorize = true
        const mobile = this.$el.querySelector('#mobile')
        if (mobile) mobile.disabled = false
      },
      mobile_keypress(event) {
        if (!event.key.match(/^\d$/)) event.preventDefault()
      },
      mobile_keyup(event) {
        this.validate_mobile_number()
      },
      mobile_paste(event) {
        const past_text = (event.clipboardData).getData('text/plain')
        const phone_number = parseNumber(past_text, 'US').phone
        if (phone_number) {
          this.person.mobile = phone_number
          this.validate_mobile_number()
        } else return false
      },
      code_keypress(event) {
        if (!event.key.match(/^\d$/)) event.preventDefault()
        const button = this.$el.querySelector('#submit-verification')
        const input = this.$el.querySelector('#verification-code')
        if (input.value.length === 5) button.disabled = false
      }
    }
  }
</script>
<style lang="stylus">
  form#profile-form
    fieldset
      margin-bottom: base-line
    input
      color: red
      &:focus
        outline: 0
        &::placeholder
          color: lighten(black, 30%)
      &::placeholder
        color: lighten(black, 30%)
    input#first-name
      width: 40%
      margin-right: base-line
    input#last-name
      width: 40%
    input#mobile
      min-width: (40% - base-line * 2)
      margin-right: base-line
    button#sign-out
      border: none
      padding: 0
    menu
      display: flex
      justify-content: flex-end
</style>
