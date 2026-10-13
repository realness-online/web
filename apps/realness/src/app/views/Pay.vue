<script setup>
  import { current_user } from '@/utils/serverless'
  import { get_limit, limit_lines, start_checkout } from '@/utils/model-pay'
  import { onMounted as on_mounted, ref, watch } from 'vue'

  defineOptions({ name: 'Pay' })

  const POLL_MS = 2000
  const POLL_TRIES = 15
  const ENDS_LENGTH = 10

  const just_paid = new URLSearchParams(window.location.search).has('paid')
  const status = ref(/** @type {any} */ (null))
  const error = ref('')
  const working = ref(false)

  const read = async () => get_limit(await current_user.value.getIdToken())

  const wait_for_paid = async tries => {
    if (!just_paid || status.value.plan === 'paid' || tries >= POLL_TRIES)
      return
    await new Promise(done => {
      setTimeout(done, POLL_MS)
    })
    status.value = await read()
    await wait_for_paid(tries + 1)
  }

  const load = async () => {
    if (!current_user.value) return
    error.value = ''
    try {
      status.value = await read()
      await wait_for_paid(0)
    } catch (thrown) {
      error.value = thrown.message
    }
  }

  const on_subscribe = async () => {
    working.value = true
    try {
      window.location.assign(
        await start_checkout(await current_user.value.getIdToken())
      )
    } catch (thrown) {
      error.value = thrown.message
      working.value = false
    }
  }

  const day = iso => iso.slice(0, ENDS_LENGTH)
  const warning = message =>
    message.replace(
      / ?(Subscribe for more|Top up|manage your plan) at \S+$/,
      ''
    )

  watch(current_user, load)
  on_mounted(load)
</script>

<template>
  <section id="pay" data-page>
    <h1>Model use</h1>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="status">
      <ul>
        <li v-for="line in limit_lines(status)" :key="line">{{ line }}</li>
      </ul>
      <p v-if="status.warn" role="status">{{ warning(status.warn.message) }}</p>
      <template v-if="status.plan === 'paid'">
        <p v-if="status.paid.renews">
          Your plan renews on
          <time :datetime="status.paid.renews">{{
            day(status.paid.renews)
          }}</time
          >.
        </p>
        <p v-else>
          Your plan ends on
          <time :datetime="status.paid.ends">{{ day(status.paid.ends) }}</time
          >.
        </p>
      </template>
      <template v-else>
        <p v-if="just_paid">Payment received. Your plan starts in a moment.</p>
        <p>
          $5 a month adds the house model, DeepSeek, with $5 of use each month
          at cost.
        </p>
        <button type="button" :disabled="working" @click="on_subscribe">
          {{ working ? 'Opening checkout' : 'Subscribe' }}
        </button>
      </template>
    </template>
  </section>
</template>
