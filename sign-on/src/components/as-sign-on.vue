<script setup>
  import { computed, ref } from 'vue'
  import { recaptcha, sign_in } from '@/utils/firebase'

  defineOptions({ name: 'AsSignOn' })

  const emit = defineEmits(['signed_in'])

  const phone = ref('')
  const code = ref('')
  const stage = ref('phone')
  const error = ref('')
  const working = ref(false)
  const confirmation = ref(null)

  const digits = computed(() => phone.value.replace(/\D/g, ''))
  const full_phone = computed(() => `+1${digits.value}`)
  const can_send = computed(() => digits.value.length === 10 && !working.value)

  const send_code = async () => {
    if (!can_send.value) return
    error.value = ''
    working.value = true
    try {
      const verifier = recaptcha(document.getElementById('captcha'))
      confirmation.value = await sign_in(full_phone.value, verifier)
      stage.value = 'code'
    } catch (thrown) {
      error.value = thrown?.message ?? 'Could not send the code.'
    } finally {
      working.value = false
    }
  }

  const confirm_code = async () => {
    if (working.value) return
    error.value = ''
    working.value = true
    try {
      await confirmation.value.confirm(code.value)
      stage.value = 'done'
      emit('signed_in')
    } catch {
      error.value = 'That code was incorrect. Try again.'
    } finally {
      working.value = false
    }
  }
</script>

<template>
  <section id="sign-on">
    <form v-if="stage === 'phone'" @submit.prevent="send_code">
      <label for="mobile">Mobile number</label>
      <input
        id="mobile"
        v-model="phone"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        maxlength="14"
        placeholder="(555) 555-5555"
        required />
      <button type="submit" :disabled="!can_send">Send code</button>
    </form>

    <form v-else-if="stage === 'code'" @submit.prevent="confirm_code">
      <label for="verification-code">Six-digit code</label>
      <input
        id="verification-code"
        v-model="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        required />
      <button type="submit" :disabled="working">Confirm</button>
    </form>

    <p v-else>Signed in.</p>

    <p v-if="error" role="alert">{{ error }}</p>
    <div id="captcha"></div>
  </section>
</template>
