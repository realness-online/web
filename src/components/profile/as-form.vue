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
    <fieldset>
      <label for="mobile">1+</label>
      <input id="mobile" type="tel" placeholder="(555) 555-5555"
             v-model="person.mobile"
             v-on:keypress="validate_mobile_keypress"
             v-on:paste="parse_mobile_paste"
             v-on:blur="save_person">
    </fieldset>
    <fieldset v-if='show_captcha' v-bind:class="{hide_captcha}">
      <div id="captcha"></div>
    </fieldset>
    <fieldset v-if="show_code">
      <input id="code-input" type="tel" placeholder="696969"
            v-model="code" v-on:keypress="validate_code_keypress" >
    </fieldset>
    <menu v-if="valid_mobile_number">
      <button v-if="show_authorize" v-on:click='validate_is_human'>enter realness</button>
      <button id='code' v-if="show_code" disabled v-on:click="sign_in_with_code">enter code</button>
      <button v-if="show_sign_out" v-on:click="sign_out">sign out</button>
    </menu>
  </form>
</template>

<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
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
        console.log(user)
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
      validate_is_human(event) {
        event.preventDefault()
        this.show_authorize = false
        this.show_captcha = true
        Vue.nextTick(() => {
          this.human = new firebase.auth.RecaptchaVerifier('captcha', {
            'size': 'invisible',
            'badge': 'inline',
            'callback': this.send_phone_and_captcha
          })
          this.human.verify()
        })
      },
      send_phone_and_captcha(response) {
        this.show_code = true
        this.hide_captcha = true
        firebase.auth()
          .signInWithPhoneNumber(this.mobile_as_e164, this.human)
          .then(result => {
            this.authorizer = result
            this.$el.querySelector('#code-input').scrollIntoView(false)
            this.$el.querySelector('#code-input').focus()
          }).catch(error => { console.log(error) })
      },
      sign_in_with_code(event) {
        event.preventDefault()
        this.show_code = false
        this.authorizer.confirm(this.code).then(result => {
          this.signed_in = true
        }).catch(error => { console.error(error) })
      },
      sign_out(event) {
        event.preventDefault()
        this.show_sign_out = false
        firebase.auth().signOut()
        this.show_authorize = true
      },
      validate_mobile_keypress(event) {
        if (!event.key.match(/^\d$/)) {
          event.preventDefault()
        }
      },
      validate_code_keypress(event) {
        if (!event.key.match(/^\d$/)) {
          event.preventDefault()
        }
        let button = this.$el.querySelector('#code')
        let input = this.$el.querySelector('#code-input')
        if (input.value.length === 5) { // after this keypress it will be 6
          button.disabled = false
        }
      },
      parse_mobile_paste(event) {
        let paste = (event.clipboardData).getData('text')
        this.person.mobile = parseNumber(paste, 'US').phone
        event.preventDefault()
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
      &.hide_captcha
        display: none
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
    button[disabled]
      border: 0.33vmin solid lighten(black, 50%)
      color: lighten(black, 50%)
</style>
