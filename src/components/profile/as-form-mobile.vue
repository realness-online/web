<script setup>
  import icon from '@/components/icon'
  import { auth } from '@/utils/serverless'
  import { Recaptcha, sign_in } from '@/utils/serverless-auth'
  import { check_phone_integrity as verify_phone_integrity } from '@/utils/phone-integrity'
  import { use_instance_capabilities } from '@/use/instance-capabilities'
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
  const { phone_integrity, probe } = use_instance_capabilities()
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
  const integrity_message = ref('')

  const reset_integrity_message = () => {
    integrity_message.value = ''
  }

  const restore_phone_input = () => {
    working.value = false
    show_authorize.value = true
    if (mobile.value) mobile.value.disabled = false
  }

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

  const on_validate_mobile_number = () => {
    const is_valid =
      !!mobile_number.value && valid_phone(full_phone.value, country_code.value)
    disabled_sign_in.value = !is_valid
    return is_valid
  }

  const disable_input = () => {
    if (mobile.value) mobile.value.disabled = true
  }

  const on_begin_authorization = async () => {
    reset_integrity_message()
    disable_input()
    show_authorize.value = false
    working.value = true

    await probe()
    if (phone_integrity.value) {
      const result = await verify_phone_integrity(full_phone.value)
      if (!result) {
        integrity_message.value =
          'Phone verification is unavailable. Try again in a moment.'
        restore_phone_input()
        return
      }
      if (!result.allowed) {
        integrity_message.value =
          'Use a mobile number to sign in. Virtual and VoIP numbers are not accepted.'
        restore_phone_input()
        return
      }
    }

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

  const on_sign_in_with_code = async () => {
    reset_integrity_message()
    working.value = true
    disable_input()
    show_code.value = false
    try {
      await authorizer.value.confirm(code.value)
      emit('signed-on')
    } catch {
      working.value = false
      show_code.value = true
      integrity_message.value = 'That code was incorrect. Please try again.'
    }
  }

  const on_mobile_keypress = event => {
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
    on_validate_mobile_number()
  }

  const on_mobile_paste = event => {
    const past_text = event.clipboardData.getData('text/plain')
    parse_and_apply(past_text, country_code.value)
  }

  const on_input = () => {
    reset_integrity_message()
    const raw = mobile_number.value
    if (!raw) {
      on_validate_mobile_number()
      return
    }
    const parsed = parse_phone(raw, country_code.value)
    if (parsed?.isValid?.() && parsed.country && parsed.nationalNumber)
      parse_and_apply(raw, country_code.value)
    else {
      const formatter = new as_you_type(country_code.value)
      mobile_number.value = formatter.input(raw)
      on_validate_mobile_number()
    }
  }

  // Digit-only at the point of entry; length is enforced by maxlength, not JS.
  const on_code_keypress = event => {
    if (!event.key.match(/^\d$/)) event.preventDefault()
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
    on_validate_mobile_number()
  })
</script>

<template>
  <form id="profile-mobile">
    <fieldset v-if="show_mobile_input" id="phone">
      <legend :class="{ valid: on_validate_mobile_number() }">
        {{ mobile_display }}
      </legend>
      <button
        type="button"
        id="country-toggle"
        aria-haspopup="listbox"
        :aria-expanded="show_countries"
        :aria-controls="show_countries ? 'country' : undefined"
        :aria-label="`Country, ${country?.name ?? country_code}`"
        @click.stop="show_countries = !show_countries">
        {{ country?.emoji }} +{{ phone_code(country_code) }}
      </button>
      <input
        id="mobile"
        ref="mobile"
        v-model="mobile_number"
        type="tel"
        autocomplete="tel"
        aria-label="Phone number"
        :placeholder="placeholder"
        @keypress="on_mobile_keypress"
        @keyup="on_validate_mobile_number"
        @input="on_input"
        @paste.prevent="on_mobile_paste" />
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
        maxlength="6"
        autocomplete="one-time-code"
        placeholder="6-digit code"
        @keypress="on_code_keypress" />
    </fieldset>
    <p v-if="integrity_message" id="integrity-denied" role="alert">
      {{ integrity_message }}
    </p>
    <icon v-if="working" name="working" />
    <menu v-else>
      <button
        v-if="show_authorize"
        id="authorize"
        :disabled="disabled_sign_in"
        @click.prevent="on_begin_authorization">
        Text me a code
      </button>
      <button
        v-if="show_code"
        id="submit-verification"
        @click.prevent="on_sign_in_with_code">
        Verify
      </button>
    </menu>
    <p v-if="show_authorize && !working" id="consent">
      By continuing you agree to the
      <router-link to="/terms">Terms</router-link>
      and
      <router-link to="/terms#privacy-policy">Privacy Policy</router-link>.
    </p>
  </form>
</template>

<style lang="stylus">
  form#profile-mobile {
    // Vertical rhythm only — the form is width:100% inside its container, so a
    // horizontal margin would push it past the right edge (overflow skew).
    margin: base-line 0;
    svg.remove {
      fill: var(--emphasis);
    }
    fieldset {
      margin-bottom: base-line;
      &#captcha.hide {
         display: none;
      }
      &#phone {
        overflow: visible;
        display: flex;
        flex-wrap: wrap;
        align-items: stretch;

        & > legend {
          flex: 0 0 100%;
        }

        button#country-toggle {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          margin: 0;
          margin-right: (base-line * 0.5);
          cursor: pointer;
          white-space: nowrap;
          border: none;
          background: transparent;
          font: inherit;
          line-height: 1.5;
          opacity: 0.7;
          &:focus {
            outline: none;
          }
          &:hover {
            opacity: 1;
          }
        }
        input#mobile {
          flex: 1;
          min-width: 0;
        }
        select#country {
          flex: 0 0 100%;
          width: 100%;
          max-height: 200px;
          overflow-y: auto;
          margin-top: (base-line * 0.25);
          padding: (base-line * 0.25);
          @media (prefers-color-scheme: dark) {
            background-color: var(--basalt-transparent);
            border-color: var(--emphasis);
            option:hover {
              color: var(--basalt);
            }
          }
          option {
            padding: (base-line * 0.25);
            cursor: pointer;
            &:hover {
              background-color: var(--accent);
              color: var(--bone);
            }
          }
        }
      }
    }

    button#sign-out {
      border: none;
      padding: 0;
    }

    menu {
      display: flex;
      justify-content: flex-end;
    }

    p#consent {
      margin: (base-line * 0.5) 0 0;
      font-size: 0.75em;
      opacity: 0.7;
      line-height: 1.4;
      text-align: right;

      a {
        color: var(--accent);
        &:hover {
          color: var(--emphasis);
        }
      }
    }

    p#integrity-denied {
      margin: (base-line * 0.5) 0 0;
      color: var(--emphasis);
      line-height: 1.4;
    }
  }
</style>
