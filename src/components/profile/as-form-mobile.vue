<template>
  <form id="profile-mobile">
    <fieldset v-if="show_mobile_input" id="phone">
      <legend :class="{ valid: validate_mobile_number() }">
        {{ mobile_display }}
      </legend>
      <input
        id="mobile"
        ref="mobile"
        v-model="mobile_number"
        type="tel"
        placeholder="1 (555) 555-5555"
        @keypress="mobile_keypress"
        @keyup="validate_mobile_number"
        @paste.prevent="mobile_paste" />
    </fieldset>
    <fieldset
      v-if="show_captcha"
      id="captcha"
      :class="{ hide: hide_captcha }" />
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
<script setup>
  import Icon from '@/components/icon'
  import { auth, Recaptcha, sign_in } from '@/use/serverless'
  import { as_phone_number, use_me } from '@/use/people'
  import {
    watch,
    onMounted as mounted,
    ref,
    computed,
    nextTick as next_tick
  } from 'vue'
  const emit = defineEmits(['signed-on'])
  const { me } = use_me()
  const validator = ref(null)
  const mobile = ref(null)
  const mobile_number = ref()
  const working = ref(true)
  const disabled_sign_in = ref(true)
  const code = ref(null)
  const human = ref(null)
  const authorizer = ref(null)
  const show_authorize = ref(false)
  const show_captcha = ref(false)
  const hide_captcha = ref(false)
  const show_code = ref(false)
  const show_mobile_input = computed(() => {
    if (working.value) return false
    return true
  })
  const mobile_display = computed(() => {
    if (me.value.mobile)
      return new validator.value.AsYouType('US').input(me.value.mobile)
    else return 'Mobile'
  })
  const validate_mobile_number = () => {
    let is_valid = false
    if (!validator.value) return false
    if (me.value.mobile)
      is_valid = validator.value.parseNumber(me.value.mobile, 'US').phone
    disabled_sign_in.value = !is_valid
    return is_valid
  }
  const disable_input = () => {
    mobile.value.disabled = true
  }
  const begin_authorization = async () => {
    working.value = true
    disable_input()
    show_authorize.value = false
    show_captcha.value = true
    await next_tick()
    human.value = new Recaptcha(
      'captcha',
      {
        size: 'invisible',
        callback: text_human_verify_code
      },
      auth
    )
    human.value.verify()
  }
  const text_human_verify_code = async () => {
    working.value = false
    show_code.value = true
    hide_captcha.value = true
    await next_tick()
    authorizer.value = await sign_in(
      auth,
      `+${me.value.mobile}`,
      human.value
    )
    document.querySelector('#verification-code').scrollIntoView(false)
    document.querySelector('#verification-code').focus()
  }
  const sign_in_with_code = async () => {
    working.value = true
    disable_input()
    show_code.value = false
    try {
      await authorizer.value.confirm(code.value)
      emit('signed-on')
    } catch (e) {
      if (e.code === 'auth/invalid-verification-code') {
        mobile.value.disabled = false
        show_code.value = true
      }
    }
  }

  const mobile_keypress = event => {
    if (!event.key.match(/^\d$/)) event.preventDefault()
  }
  const mobile_paste = event => {
    const past_text = event.clipboardData.getData('text/plain')
    const phone_number = validator.value.parseNumber(past_text, 'US').phone
    if (phone_number) {
      me.value.mobile = phone_number
      return validate_mobile_number()
    } else return false
  }
  const code_keypress = event => {
    if (!event.key.match(/^\d$/)) event.preventDefault()
    const button = document.querySelector('#submit-verification')
    const input = document.querySelector('#verification-code')
    if (input.value.length === 5) button.disabled = false
  }

  watch(mobile_number, () => {
    me.value.mobile = mobile_number.value
  })
  mounted(async () => {
    validator.value = await import('libphonenumber-js')
    working.value = false

    me.value.mobile = as_phone_number(me.value.id)
    if (!me.value.mobile.length) me.value.mobile = null
    show_authorize.value = true
    mobile_number.value = me.value.mobile
    validate_mobile_number()
  })
</script>
<style lang="stylus">
  form#profile-mobile
    animation-name: slide-in-left
    svg.remove
      fill: red
    fieldset
      margin-bottom: base-line
      &#captcha.hide
        display: none
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
