<template lang="html">
  <form id="profile-form">
    <fieldset id="name">
      <input id="first-name" type='text' placeholder="First" required
             v-model="person.first_name"
             v-on:blur="save_person">
      <input id="last-name" type='text' placeholder="Last" required
             v-model="person.last_name"
             v-on:blur="save_person">
    </fieldset>
    <fieldset id="phone">
      <label for="mobile">1+</label>
      <input id="mobile" type="tel" placeholder="(555) 555-5555"
             v-model="person.mobile"
             v-on:keypress="mobile_keypress"
             v-on:paste="mobile_paste"
             v-on:blur="save_person">
      <input id="verification-code" type="tel" placeholder="Verification code"
             v-if="show_code"
             v-model="code"
             v-on:keypress="code_keypress" >
      <div id="captcha"
           v-if='show_captcha'
           v-bind:class="{hide_captcha}">
      </div>
    </fieldset>
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
  export default {
    props: ['person'],
    data() {
      return {
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
        if (user) {
          this.show_sign_out = true
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
      save_person() {
        this.storage.save()
      },
      begin_authorization(event) {
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
        this.show_code = true
        this.hide_captcha = true
        firebase.auth()
          .signInWithPhoneNumber(this.mobile_as_e164, this.human)
          .then(result => {
            this.authorizer = result
            this.$el.querySelector('#verification-code').scrollIntoView(false)
            this.$el.querySelector('#verification-code').focus()
          }).catch(error => {
            console.log(error)
          })
      },
      sign_in_with_code(event) {
        event.preventDefault()
        this.show_code = false
        this.authorizer.confirm(this.code).then(result => {
          this.show_sign_out = true
        }).catch(error => {
          console.error(error)
        })
      },
      sign_out(event) {
        event.preventDefault()
        this.show_sign_out = false
        firebase.auth().signOut()
        this.show_authorize = true
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
      padding: (base-line / 2 )
      border: 0.33vmin solid currentColor
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
    button
      border: 0.33vmin solid currentColor
      padding: (base-line / 2) (base-line / 2 )
      text-transform:capitalize
    button[disabled]
      border: 0.33vmin solid lighten(black, 50%)
      color: lighten(black, 50%)
</style>
