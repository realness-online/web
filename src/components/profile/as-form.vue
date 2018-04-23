<template lang="html">
  <form id="profile-form">
    <fieldset id="name">
      <input id="first-name" type='text' placeholder="First" required
             v-model="person.first_name"
             v-on:blur="save_person">
      <input id="last-name" type='text' placeholder="Last" required
             v-model="person.last_name">
    </fieldset>
    <fieldset>
      <label for="mobile">1+</label>
      <input id="mobile" type="tel" placeholder="(555) 555-5555"
             v-model="person.mobile"
             v-on:keypress="validate_mobile_keypress"
             v-on:paste="parse_mobile_paste"
             v-on:blur="save_person"
             v-on:focus='scroll_into_view'>
    </fieldset>
    <fieldset v-if='show_captcha' >
      <div id="captcha"></div>
    </fieldset>
    <fieldset v-if="show_code">
      <input id="verification-code" type="tel" placeholder="696969"
             v-model="verification_code" >
    </fieldset>
    <menu v-if="valid_mobile_number">
      <button id="authorize" v-if="show_button" v-on:click='validate_is_human'>join realness </button>
      <button id="enter" v-if="show_code">Enter</button>
    </menu>
  </form>
</template>

<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import {parseNumber} from 'libphonenumber-js'
  import {person_storage} from '@/modules/Storage'
  const valid_mobile_digit = /^\d$/ // ^ begining, \d is a digit, $ end
  export default {
    props: ['person'],
    data() {
      return {
        storage: person_storage,
        show_button: true,
        show_captcha: false,
        show_code: false,
        verification_code: null,
        human_verifier: null
      }
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
      validate_is_human(event) {
        event.preventDefault()
        this.show_button = false
        this.show_captcha = true
        console.log('authorize')
        Vue.nextTick(() => {
          this.human_verifier = new firebase.auth.RecaptchaVerifier('captcha', {
            'size': 'invisible',
            'badge': 'inline',
            'callback': this.send_verification_code
          })
          this.human_verifier.verify()
        })
      },
      send_verification_code(response) {
        console.log('reCAPTCHA solved')
        this.show_captcha = false
        this.show_code = true
        firebase.auth()
          .signInWithPhoneNumber(this.mobile_as_e164, this.human_verifier)
          .then(confirmationResult => {
            console.log('SMS sent.', confirmationResult)
            this.sign_in_with_code(confirmationResult)
            this.human_verifier.clear()
            this.$el.querySelector('verification-code').focus()
          })
          .catch(error => {
            console.log('Error; SMS not sent', error)
          })
      },
      sign_in_with_code() {
        console.log('sign_in_with_code')
      },
      save_person() {
        this.storage.save()
      },
      validate_mobile_keypress(event) {
        if (!event.key.match(valid_mobile_digit)) {
          event.preventDefault()
        }
      },
      parse_mobile_paste(event) {
        let paste = (event.clipboardData).getData('text')
        this.person.mobile = parseNumber(paste, 'US').phone
        event.preventDefault()
      },
      scroll_into_view(event) {
        event.target.scrollIntoView(false)
      }
    }
  }
</script>

<style lang="stylus">
  @require '../../style/variables'
  form#profile-form
    & > fieldset
      padding: (base-line / 2 )
      border: 0.33vmin solid black
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
      border: 0.33vmin solid black
      padding: (base-line / 2) (base-line / 2 )
      text-transform:capitalize
</style>
