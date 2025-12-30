<script setup>
  import Icon from '@/components/icon'
  import { auth, Recaptcha, sign_in } from '@/utils/serverless'
  import { as_phone_number, use_me } from '@/use/people'
  import {
    countries,
    default_country,
    phone_code,
    valid_phone,
    parse_phone,
    as_you_type,
    format_phone
  } from '@/utils/phone'
  import { onMounted as mounted, ref, computed, nextTick as tick } from 'vue'

  const emit = defineEmits(['signed-on'])
  const { me } = use_me()
  const mobile = ref(null)
  const mobile_number = ref('')
  const working = ref(true)
  const disabled_sign_in = ref(true)
  const code = ref(null)
  const human = ref(null)
  const authorizer = ref(null)
  const show_authorize = ref(false)
  const show_captcha = ref(false)
  const hide_captcha = ref(false)
  const country_code = ref(default_country)
  const show_code = ref(false)
  const show_countries = ref(false)

  const country = computed(() =>
    countries.find(c => c.code === country_code.value)
  )

  const show_mobile_input = computed(() => !working.value && !show_code.value)

  const full_phone = computed(() => {
    const code = phone_code(country_code.value)
    return `+${code}${mobile_number.value}`
  })

  const mobile_display = computed(() => {
    if (mobile_number.value) {
      const formatted = format_phone(full_phone.value)
      return formatted || mobile_number.value
    }
    return 'Mobile'
  })

  const placeholder = computed(() =>
    country_code.value === default_country ? '(555) 555-5555' : null
  )

  const validate_mobile_number = () => {
    const is_valid =
      !!mobile_number.value && valid_phone(full_phone.value, country_code.value)
    disabled_sign_in.value = !is_valid
    return is_valid
  }

  const disable_input = () => {
    if (mobile.value) mobile.value.disabled = true
  }

  const begin_authorization = async () => {
    working.value = true
    disable_input()
    show_authorize.value = false
    show_captcha.value = true
    await tick()
    human.value = new Recaptcha(auth.value, 'captcha', {
      size: 'invisible',
      callback: text_human_verify_code
    })
    human.value.verify()
  }

  const text_human_verify_code = async () => {
    working.value = false
    show_code.value = true
    hide_captcha.value = true
    await tick()
    authorizer.value = await sign_in(auth.value, full_phone.value, human.value)
    const verifier = document.querySelector('#verification-code')
    if (verifier) {
      verifier.scrollIntoView(false)
      verifier.focus()
    }
  }

  const sign_in_with_code = async () => {
    working.value = true
    disable_input()
    show_code.value = false
    await authorizer.value.confirm(code.value)
    emit('signed-on')
  }

  const mobile_keypress = event => {
    if (!event.key.match(/^\d$/)) event.preventDefault()
  }

  const mobile_paste = event => {
    const past_text = event.clipboardData.getData('text/plain')
    const parsed = parse_phone(past_text, country_code.value)
    if (parsed?.nationalNumber) {
      mobile_number.value = parsed.nationalNumber
      validate_mobile_number()
    }
  }

  const handle_input = () => {
    if (mobile_number.value) {
      const formatter = new as_you_type(country_code.value)
      const formatted = formatter.input(mobile_number.value)
      mobile_number.value = formatted
    }
    validate_mobile_number()
  }

  const code_keypress = event => {
    if (!event.key.match(/^\d$/)) event.preventDefault()
    const button = document.querySelector('#submit-verification')
    const input = document.querySelector('#verification-code')
    if (input && input.value.length === 5 && button) button.disabled = false
  }

  mounted(() => {
    working.value = false
    if (me.value?.id) mobile_number.value = as_phone_number(me.value.id)

    show_authorize.value = true
    validate_mobile_number()
  })
</script>

<template>
  <form id="profile-mobile">
    <fieldset v-if="show_mobile_input" id="phone">
      <legend :class="{ valid: validate_mobile_number() }">
        {{ mobile_display }}
      </legend>
      <label for="mobile">
        <button
          type="button"
          id="country-toggle"
          @click="show_countries = !show_countries">
          {{ country?.emoji }} +{{ phone_code(country_code) }}
        </button>
        <input
          id="mobile"
          ref="mobile"
          v-model="mobile_number"
          type="tel"
          autocomplete="tel"
          :placeholder="placeholder"
          @keypress="mobile_keypress"
          @keyup="validate_mobile_number"
          @input="handle_input"
          @paste.prevent="mobile_paste" />
      </label>
      <select
        v-if="show_countries"
        id="country"
        v-model="country_code"
        autocomplete="country"
        @change="show_countries = false"
        size="8">
        <option v-for="c in countries" :key="c.code" :value="c.code">
          {{ c.emoji }} {{ c.name }} +{{ c.phone }}
        </option>
      </select>
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

<style lang="stylus">
  form#profile-mobile
    animation-name: slide-in-left
    svg.remove
      fill: red
    fieldset
      margin-bottom: base-line
      &#captcha.hide
        display: none
      &#phone
        position: relative

        label[for=mobile]
          display: flex
          align-items: center

          button#country-toggle
            border: none
            padding: 0
            margin-right: (base-line * 0.5)
            cursor: pointer
            white-space: nowrap
            opacity: 0.7

            &:hover
              opacity: 1

            &:focus
              opacity: 1

          input#mobile
            flex: 1

        select#country
          position: absolute
          top: 100%
          left: 0
          right: 0
          max-height: 200px
          overflow-y: auto
          z-index: 100
          border: 1px solid black
          background-color: white
          padding: (base-line * 0.25)
          margin-top: (base-line * 0.25)

          @media (prefers-color-scheme: dark)
            background-color: black
            border-color: red

          option
            padding: (base-line * 0.25)
            cursor: pointer

            &:hover
              background-color: green
              color: white
    button#sign-out
      border: none
      padding: 0
    menu
      display: flex
      justify-content: flex-end
</style>
