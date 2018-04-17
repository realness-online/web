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
             v-on:blur="save_person">
      <button id="authorize" class="red"
              v-if='valid_mobile_number'
              v-on:click='authorize'>Sync</button>
    </fieldset>
  </form>
</template>

<script>
  import {parseNumber} from 'libphonenumber-js'
  import {person_storage} from '@/modules/Storage'
  const valid_mobile_digit = /^\d$/ // ^ begining, \d is a digit, $ end
  export default {
    props: ['person'],
    data() {
      return {
        storage: person_storage
      }
    },
    computed: {
      valid_mobile_number() {
        return !!this.person.mobile && parseNumber(this.person.mobile, 'US').phone
      }
    },
    methods: {
      authorize() {
        // let recaptcha = new firebase.auth.RecaptchaVerifier('authorize', {
        //   'size': 'invisible',
        //   'callback': (response) => {
        //     onSignInSubmit() // reCAPTCHA solved, allow signInWithPhoneNumber.
        //   }
        // })
        //
        // firebase.auth().signInWithPhoneNumber(this.person.mobile, recaptcha)
        //   .then(function (confirmationResult) {
        //     // SMS sent. Prompt user to type the code from the message, then sign the
        //     // user in with confirmationResult.confirm(code).
        //     window.confirmationResult = confirmationResult;
        //   }).catch(function (error) {
        //     // Error; SMS not sent
        //     // ...
        //   });
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
      }
    }
  }
</script>

<style lang="stylus">
  @require '../../style/variables'
  form#profile-form
    & > fieldset
      padding: (base-line / 2 )
      border:0.33vmin solid black
      margin-bottom: base-line
      &:last-of-type
        margin-bottom:0
    input
      color: red
      &:focus
        outline:0
        &::placeholder
          color:lighten(black, 30%)
      &::placeholder
        color: orange
    label[for=mobile]
      margin-right:-0.3em
    input#first-name
      width:40%
      margin-right:base-line
    input#last-name
      width:40%
    input#mobile
      min-width: (40% - base-line * 2)
      margin-right: base-line
    button
      margin-top:base-line
      padding: (base-line / 11) (base-line / 2 )
</style>
