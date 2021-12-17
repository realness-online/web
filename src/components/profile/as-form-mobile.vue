<template>
  <form id="profile-mobile">
    <fieldset v-if="show_mobil_input" id="phone">
      <legend :class="{ valid: validate_mobile_number() }">
        {{ mobile_display }}
      </legend>
      <input
        id="mobile"
        ref="mobile"
        v-model="mobile"
        type="tel"
        placeholder="1 (555) 555-5555"
        @keypress="mobile_keypress"
        @keyup="validate_mobile_number"
        @paste.prevent="mobile_paste" />
    </fieldset>
    <fieldset v-if="show_captcha" id="captcha" :class="{ hide_captcha }" />
    <fieldset v-if="show_code">
      <input
        id="verification-code"
        v-model="code"
        type="tel"
        required
        autocomplete="one-time-code"
        placeholder="Verification Code"
        @keypress="code_keypress" />
    </fieldset>
    <icon v-if="working" name="working" />
    <menu v-else>
      <button
        v-if="show_authorize"
        id="authorize"
        :disabled="disabled_sign_in"
        @click.prevent="begin_authorization">
        Sign on
      </button>
      <button
        v-if="show_code"
        id="submit-verification"
        @click.prevent="sign_in_with_code">
        Sign on
      </button>
    </menu>
  </form>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/auth'
  import { as_phone_number } from '@/use/profile'
  import icon from '@/components/icon'
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
    emits: ['update:person', 'signed-on'],
    data() {
      return {
        validate: null,
        mobile: null,
        working: true,
        disabled_sign_in: true,
        code: null,
        human: null,
        authorizer: null,
        show_authorize: false,
        show_captcha: false,
        hide_captcha: false,
        show_code: false
      }
    },
    computed: {
      show_mobil_input() {
        if (this.working) return false
        return true
      },
      mobile_display() {
        if (this.person.mobile)
          return new this.validate.AsYouType('US').input(this.person.mobile)
        else return 'Mobile'
      }
    },
    watch: {
      mobile() {
        const update = { ...this.person }
        update.mobile = this.mobile
        this.$emit('update:person', update)
      }
    },
    async created() {
      this.validate = await import('libphonenumber-js')
      this.working = false
      const updated = { ...this.person }
      updated.mobile = as_phone_number(this.person.id)
      if (!updated.mobile.length) updated.mobile = null
      this.show_authorize = true
      this.mobile = updated.mobile
      this.validate_mobile_number()
    },
    methods: {
      validate_mobile_number() {
        const is_valid =
          !!this.person.mobile &&
          this.validate.parseNumber(this.person.mobile, 'US').phone
        this.disabled_sign_in = !is_valid
        return is_valid
      },
      disable_input() {
        this.$refs.mobile.disabled = true
      },
      async begin_authorization() {
        // this.working = true
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
      async text_human_verify_code() {
        this.working = false
        this.show_code = true
        this.show_captcha = false
        this.hide_captcha = true
        this.authorizer = await firebase
          .auth()
          .signInWithPhoneNumber(`+1${this.person.mobile}`, this.human)
        this.$el.querySelector('#verification-code').scrollIntoView(false)
        this.$el.querySelector('#verification-code').focus()
      },
      async sign_in_with_code() {
        this.working = true
        this.disable_input()
        this.show_code = false
        try {
          await this.authorizer.confirm(this.code)
          this.$emit('signed-on', this.person)
        } catch (e) {
          if (e.code === 'auth/invalid-verification-code') {
            this.$refs.mobile.disabled = false
            this.show_code = true
          }
        }
      },
      mobile_keypress(event) {
        if (!event.key.match(/^\d$/)) event.preventDefault()
      },
      mobile_paste(event) {
        const past_text = event.clipboardData.getData('text/plain')
        const phone_number = this.validate.parseNumber(past_text, 'US').phone
        if (phone_number) {
          const update = { ...this.person }
          update.mobile = phone_number
          this.$emit('update:person', update)
          return this.validate_mobile_number()
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
  form#profile-mobile
    animation-name: slide-in-left
    svg.remove
      fill: red
    fieldset
      margin-bottom: base-line
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
