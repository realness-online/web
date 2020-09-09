<template lang="html">
  <form id="profile-form">
    <fieldset v-if="!show_sign_out" id="phone">
      <legend :class="{ valid: validate_mobile_number() }">{{ mobile_display }}</legend>
      <label for="mobile">1</label>
      <input id="mobile" v-model="person.mobile"
             type="tel"
             tabindex="3"
             placeholder="(555) 555-5555"
             @keypress="mobile_keypress"
             @keyup="mobile_keyup"
             @paste.prevent="mobile_paste"
             @blur="modified_check">
    </fieldset>
    <fieldset v-if="show_captcha" id="captcha" :class="{hide_captcha}" />
    <fieldset v-if="show_code">
      <input id="verification-code" v-model="code"
             type="tel"
             tabindex="4"
             placeholder="Verification Code"
             @keypress="code_keypress">
    </fieldset>
    <icon v-show="working" name="working" />
    <menu>
      <button v-if="show_authorize"
              id="authorize"
              tabindex="5"
              :disabled="disabled_sign_in"
              @click.prevent="begin_authorization">
        Sign on
      </button>
      <button v-if="show_code"
              id="submit-verification"
              tabindex="6"
              @click.prevent="sign_in_with_code">
        Sign on
      </button>
      <button v-if="show_sign_out"
              id="sign-out"
              @click.prevent="sign_out">
        <icon name="remove" />
      </button>
    </menu>
  </form>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import { parseNumber, AsYouType } from 'libphonenumber-js'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  import itemid from '@/helpers/itemid'
  export default {
    components: {
      icon
    },
    props: {
      person: {
        type: Object,
        required: true
      }
    },
    data () {
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
    computed: {
      mobile_display () {
        if (this.person.mobile) return new AsYouType('US').input(this.person.mobile)
        else return 'Mobile'
      }
    },
    created () {
      console.info(`Shows ${this.person.first_name} the sign on form`)
      firebase.auth().onAuthStateChanged(user => {
        this.working = false
        if (user) {
          this.show_sign_out = true
          this.person.id = profile.from_e64(user.phoneNumber)
        } else {
          this.person.mobile = profile.as_phone_number(this.person.id)
          this.show_authorize = true
        }
        this.validate_mobile_number()
      })
    },
    mounted () {
      firebase.auth().onAuthStateChanged(user => {
        if (user) this.disable_input()
      })
    },
    methods: {
      validate_mobile_number () {
        const is_valid = !!this.person.mobile && parseNumber(this.person.mobile, 'US').phone
        this.disabled_sign_in = !is_valid
        return is_valid
      },
      disable_input () {
        const mobile = this.$el.querySelector('#mobile')
        if (mobile) mobile.disabled = true
      },
      enable_input () {
        const mobile = this.$el.querySelector('#mobile')
        if (mobile) mobile.disabled = false
      },
      async modified_check () {
        const me = await itemid.load(localStorage.me)
        if (!me) {
          this.$emit('modified')
          return
        }
        let modified = false
        if (me.id !== this.person.id) modified = true
        if (me.first_name !== this.person.first_name) modified = true
        if (me.last_name !== this.person.last_name) modified = true
        if (me.mobile !== this.person.mobile) modified = true
        if (modified) this.$emit('modified', this.person)
      },
      async begin_authorization (event) {
        this.working = true
        this.disable_input()
        this.show_authorize = false
        this.show_captcha = true
        await this.$nextTick()
        this.human = new firebase.auth.RecaptchaVerifier('captcha', {
          size: 'invisible',
          callback: this.text_human_verify_code
        })
        this.human.verify()
      },
      async text_human_verify_code (response) {
        this.working = false
        this.show_code = true
        this.show_captcha = false
        this.hide_captcha = true
        this.authorizer = await firebase.auth()
        .signInWithPhoneNumber(`+1${this.person.mobile}`, this.human)
        this.$el.querySelector('#verification-code').scrollIntoView(false)
        this.$el.querySelector('#verification-code').focus()
      },
      async sign_in_with_code (event) {
        this.working = true
        this.disable_input()
        this.show_code = false
        try {
          await this.authorizer.confirm(this.code)
          this.$emit('signed-on', this.person)
          this.show_sign_out = true
        } catch (e) {
          if (e.code === 'auth/invalid-verification-code') {
            this.enable_input()
            this.show_code = true
          }
        } finally {
          this.working = false
        }
      },
      sign_out (event) {
        firebase.auth().signOut()
        this.show_sign_out = false
        this.show_authorize = true
        this.enable_input()
      },
      mobile_keypress (event) {
        if (!event.key.match(/^\d$/)) event.preventDefault()
      },
      mobile_keyup (event) {
        this.validate_mobile_number()
      },
      mobile_paste (event) {
        const past_text = (event.clipboardData).getData('text/plain')
        const phone_number = parseNumber(past_text, 'US').phone
        if (phone_number) {
          this.person.mobile = phone_number
          this.validate_mobile_number()
        } else return false
      },
      code_keypress (event) {
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
    svg.remove
      fill: red
    fieldset
      margin-bottom: base-line
      legend
        color: lighten(black, 30%)
        &.valid
          color: green
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
