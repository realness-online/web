<script setup>
  import { onMounted, ref, watch } from 'vue'
  import AsSignOn from '@/components/as-sign-on.vue'
  import { current_user } from '@/utils/firebase'
  import { get_limit, limit_lines, start_checkout } from '@/utils/pay'

  /* b1d: free use counts tokens; $5 a month adds the house model at cost.
     Stripe's webhook writes the plan, so after paying this page waits for it. */
  defineOptions({ name: 'Pay' })

  const proxy_url = import.meta.env.VITE_BRAYNESS_PROXY_URL
  const just_paid = new URLSearchParams(window.location.search).has('paid')
  const status = ref(/** @type {any} */ (null))
  const error = ref('')
  const working = ref(false)

  const load = async () => {
    const user = current_user.value
    if (!user || !proxy_url) return
    error.value = ''
    try {
      status.value = await get_limit(proxy_url, await user.getIdToken())
      for (let tries = 0; just_paid && status.value.plan !== 'paid' && tries < 15; tries++) {
        await new Promise(done => setTimeout(done, 2000))
        status.value = await get_limit(proxy_url, await user.getIdToken())
      }
    } catch (thrown) {
      error.value = thrown.message
    }
  }

  const on_subscribe = async () => {
    working.value = true
    try {
      window.location.assign(await start_checkout(proxy_url, await current_user.value.getIdToken()))
    } catch (thrown) {
      error.value = thrown.message
      working.value = false
    }
  }

  watch(current_user, load)
  onMounted(load)
</script>

<template>
  <section id="pay" data-page>
    <h1>Model use</h1>
    <as-sign-on v-if="!current_user" />
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="status">
      <ul>
        <li v-for="line in limit_lines(status)" :key="line">{{ line }}</li>
      </ul>
      <p v-if="status.warn" role="status">{{ status.warn.message.replace(/ ?(Subscribe for more|Top up|manage your plan) at \S+$/, '') }}</p>
      <template v-if="status.plan === 'paid'">
        <p v-if="status.paid.renews">Your plan renews on <time :datetime="status.paid.renews">{{ status.paid.renews.slice(0, 10) }}</time>.</p>
        <p v-else>Your plan ends on <time :datetime="status.paid.ends">{{ status.paid.ends.slice(0, 10) }}</time>.</p>
      </template>
      <template v-else>
        <p v-if="just_paid">Payment received. Your plan starts in a moment.</p>
        <p>$5 a month adds the house model, DeepSeek, with $5 of use each month at cost.</p>
        <button type="button" :disabled="working" @click="on_subscribe">{{ working ? 'Opening checkout' : 'Subscribe' }}</button>
      </template>
    </template>
  </section>
</template>
