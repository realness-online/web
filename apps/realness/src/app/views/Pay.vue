<script setup>
  import { current_user } from '@/utils/serverless'
  import { get_limit, start_checkout } from '@/utils/model-pay'
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
    try {
      status.value = await read()
      await wait_for_paid(0)
    } catch {
      status.value = null
    }
  }

  const on_subscribe = async () => {
    if (!current_user.value) return window.location.assign('/sign-on?next=/pay')
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
  const dollars = value => `$${value.toFixed(2)}`

  watch(current_user, load)
  on_mounted(load)
</script>

<template>
  <section id="pay" data-page>
    <article v-if="status?.plan === 'paid'">
      <header>
        <h1>Realness</h1>
        <p>
          <data :value="status.paid.used">{{ dollars(status.paid.used) }}</data>
          of
          <data :value="status.paid.credit">{{
            dollars(status.paid.credit)
          }}</data>
          used
        </p>
      </header>
      <p v-if="status.paid.renews">
        Renews
        <time :datetime="status.paid.renews">{{
          day(status.paid.renews)
        }}</time>
      </p>
      <p v-else>
        Ends
        <time :datetime="status.paid.ends">{{ day(status.paid.ends) }}</time>
      </p>
    </article>
    <article v-else itemscope itemtype="https://schema.org/Offer">
      <header>
        <h1 itemprop="name">Realness</h1>
      </header>
      <p>
        <meta itemprop="priceCurrency" content="USD" />
        <data itemprop="price" value="5">$5</data>
        <small>a month</small>
      </p>
      <p itemprop="description">
        Pi's model, ready in your terminal. No API key.
      </p>
      <p v-if="just_paid" role="status">
        Payment received. Starting your plan.
      </p>
      <button type="button" :disabled="working" @click="on_subscribe">
        {{ working ? 'Opening checkout' : 'Subscribe' }}
      </button>
      <p v-if="error" role="alert">{{ error }}</p>
    </article>
  </section>
</template>

<style lang="stylus">
  section#pay[data-page] {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: base-line * 2 base-line base-line * 4;

    & > article {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: base-line;
      max-width: base-line * 20;
      margin-inline: auto;
      text-align: center;

      & > header {
        & > h1 {
          margin: 0;
          color: var(--accent);
        }

        & > p {
          margin: 0;
        }
      }

      & > p {
        margin: 0;

        & > data[itemprop='price'] {
          font-size: base-line * 3;
          line-height: 1;
          font-weight: 300;
          color: var(--accent);
        }
      }

      & > button {
        min-width: base-line * 10;
        padding: base-line * 0.5 base-line * 1.5;
        font-size: base-line;
        color: var(--black-dark, inherit);
        background-color: var(--accent);
        border: none;
        border-radius: base-line;
        cursor: pointer;

        &:hover,
        &:focus-visible {
          filter: brightness(1.1);
        }

        &:disabled {
          opacity: 0.6;
          cursor: progress;
        }
      }

      & > p[role='alert'] {
        color: var(--red, inherit);
      }
    }
  }
</style>
