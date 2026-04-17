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
    as_you_type
  } from '@/utils/phone'
  import {
    onMounted as mounted,
    ref,
    computed,
    nextTick as tick,
    watchEffect as watch_effect
  } from 'vue'

  const emit = defineEmits(['signed-on', 'working'])
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

  const mobile_display = computed(() => mobile_number.value || 'Mobile')

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
    disable_input()
    show_authorize.value = false
    show_captcha.value = true
    await tick()
    const captcha_element = document.getElementById('captcha')
    working.value = true
    const theme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    human.value = new Recaptcha(auth.value, captcha_element, {
      size: 'invisible',
      theme,
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
    if (verifier) verifier.scrollIntoView(false)
  }

  const sign_in_with_code = async () => {
    working.value = true
    disable_input()
    show_code.value = false
    await authorizer.value.confirm(code.value)
    emit('signed-on')
  }

  const mobile_keypress = event => {
    const { key } = event
    if (key.match(/^\d$/) || (key === '+' && !mobile_number.value)) return
    event.preventDefault()
  }

  const parse_and_apply = (raw, fallback_country) => {
    const parsed = parse_phone(raw, fallback_country)
    if (!parsed?.nationalNumber) return
    if (parsed.country) country_code.value = parsed.country
    const formatter = new as_you_type(parsed.country || fallback_country)
    mobile_number.value = formatter.input(parsed.nationalNumber)
    validate_mobile_number()
  }

  const mobile_paste = event => {
    const past_text = event.clipboardData.getData('text/plain')
    parse_and_apply(past_text, country_code.value)
  }

  const handle_input = () => {
    const raw = mobile_number.value
    if (!raw) {
      validate_mobile_number()
      return
    }
    const parsed = parse_phone(raw, country_code.value)
    if (parsed?.isValid?.() && parsed.country && parsed.nationalNumber)
      parse_and_apply(raw, country_code.value)
    else {
      const formatter = new as_you_type(country_code.value)
      mobile_number.value = formatter.input(raw)
      validate_mobile_number()
    }
  }

  const code_keypress = event => {
    if (!event.key.match(/^\d$/)) event.preventDefault()
    const button = document.querySelector('#submit-verification')
    const input = document.querySelector('#verification-code')
    if (input && input.value.length === 5 && button) button.disabled = false
  }

  watch_effect(() => {
    emit('working', working.value)
  })

  mounted(() => {
    working.value = false
    if (me.value?.id) {
      const raw = `+${as_phone_number(me.value.id)}`
      parse_and_apply(raw, country_code.value)
    }

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
      <label for="mobile" class="phone-input-row">
        <button
          type="button"
          id="country-toggle"
          class="phone-country-toggle"
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
    <fieldset id="captcha" hidden />
    <fieldset v-if="show_code && !working">
      <input
        id="verification-code"
        v-model="code"
        type="tel"
        inputmode="numeric"
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
        <icon name="silhouette" />
      </button>
      <button
        v-if="show_code"
        id="submit-verification"
        @click.prevent="sign_in_with_code">
        <icon name="silhouette" />
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

        label.phone-input-row
          display: flex
          flex-wrap: nowrap
          align-items: stretch
          width: 100%
          min-width: 0

          button#country-toggle.phone-country-toggle
            flex-shrink: 0
            display: flex
            align-items: center
            margin: 0
            margin-right: (base-line * 0.5)
            padding: (base-line * 0.5) (base-line * 0.75)
            cursor: pointer
            white-space: nowrap
            border: none
            border-right: 1px solid
            border-color: inherit
            background: transparent
            font: inherit
            line-height: 1.5
            opacity: 0.7

            &:hover
              opacity: 1

            &:focus
              opacity: 1

          input#mobile
            flex: 1
            min-width: 0

        select#country
          position: absolute
          top: 100%
          left: 0
          right: 0
          max-height: 200px
          overflow-y: auto
          z-index: 7
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
              background-color: blue
              color: white
    button#sign-out
      border: none
      padding: 0
    menu
      display: flex
      justify-content: flex-end
      & > button svg.silhouette
        fill: blue
</style>
