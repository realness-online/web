<script setup>
  import { computed, onMounted as mounted, ref, watch } from 'vue'
  import { useRoute as use_route } from 'vue-router'
  import AsFigure from '@/components/posters/as-figure'
  import { load } from '@/utils/itemid'
  import { poster_ratio } from '@/use/poster-aspect'
  import { as_money, print_thought, use_print_editions } from '@/use/print-shop'

  const route = use_route()
  const admin_id = import.meta.env.VITE_ADMIN_ID
  const contact_url = `sms:${admin_id.slice(1)}`
  const SHARE_STATE_MS = 2000

  const created = computed(() => String(route.params.id ?? ''))
  const itemid = computed(() => `${admin_id}/posters/${created.value}`)

  const ratio = ref(1)
  const thought = ref('')
  const {
    amounts: editions,
    sold,
    currency,
    checked: editions_checked,
    loading: loading_editions,
    buying,
    buy_error,
    is_sold,
    load: load_editions,
    buy
  } = use_print_editions(itemid)

  const hydrate = async () => {
    const item = await load(itemid.value).catch(() => null)
    ratio.value = poster_ratio(item?.viewbox) ?? 1
    thought.value = await print_thought(itemid.value)
    await load_editions()
  }

  mounted(hydrate)
  watch(itemid, hydrate)

  const share_state = ref('')
  let share_timer = null

  const share = async () => {
    const url = window.location.href
    if (navigator.share)
      try {
        await navigator.share({ title: 'Hand-finished print', url })
        return
      } catch {
        return
      }

    await navigator.clipboard?.writeText(url)
    share_state.value = 'Link copied'
    clearTimeout(share_timer)
    share_timer = setTimeout(() => (share_state.value = ''), SHARE_STATE_MS)
  }
</script>

<template>
  <section id="print" data-page :style="{ '--ratio': ratio }">
    <nav>
      <router-link to="/prints">All prints</router-link>
    </nav>

    <as-figure :itemid="itemid" pin />

    <h1>Hand-finished print</h1>
    <blockquote v-if="thought">{{ thought }}</blockquote>

    <form @submit.prevent>
      <ol v-if="editions.length">
        <li v-for="amount in editions" :key="amount">
          <button
            type="button"
            :disabled="is_sold(amount)"
            :aria-busy="buying"
            @click="buy(amount)">
            <data :value="amount">{{ as_money(amount, currency) }}</data>
            <span
              class="sold"
              :class="{ 'is-sold': sold.includes(amount) }"
              :aria-label="sold.includes(amount) ? 'Sold' : undefined"
              >&#9679;</span
            >
          </button>
        </li>
      </ol>
      <p v-else-if="loading_editions" role="status">Checking editions</p>
      <p v-else-if="editions_checked" role="status">Checkout unavailable</p>
      <p v-if="buy_error" role="alert">{{ buy_error }}</p>

      <p class="shop-links">
        <button type="button" @click="share">Share this print</button>
        <span v-if="share_state" role="status">{{ share_state }}</span>
        <a
          v-if="buy_error || (editions_checked && !editions.length)"
          :href="contact_url"
          >Message the artist</a
        >
      </p>
    </form>
  </section>
</template>

<style lang="stylus">
  section#print {
    display: grid;
    justify-items: center;
    gap: base-line;
    padding: base-line base-line base-line * 6;

    & > nav {
      justify-self: start;
      width: 100%;
      max-width: page-width;
    }

    & > figure {
      width: unquote('min(88vw, calc(52vh * var(--ratio, 1)))');
      aspect-ratio: var(--ratio, 1);
      min-height: 0;
      border-radius: round((base-line / 3), 2);

      & > svg[itemid] {
        height: 100%;
        min-height: 0;
        max-height: none;
      }
    }

    & > h1 {
      margin: 0;
      font-size: unquote('clamp(1.1rem, 4vw, 1.6rem)');
    }

    & > blockquote {
      max-width: base-line * 30;
      margin: 0;
      font-style: italic;
      text-align: center;
    }

    & > form {
      display: grid;
      justify-items: center;
      gap: base-line * 0.5;
      width: 100%;
      max-width: base-line * 30;
    }

    & > form > ol {
      display: flex;
      flex-wrap: nowrap;
      gap: base-line * 0.5;
      width: 100%;
      margin: 0;
      padding: 0;
      list-style: none;

      & > li {
        flex: 1 1 0;
        min-width: 0;
      }

      & button {
        display: flex;
        justify-content: center;
        gap: base-line * 0.25;
        width: 100%;
        min-width: 0;
        padding: base-line * 0.5 base-line * 0.25;
        border: 0;
        border-radius: round((base-line / 3), 2);
        background: none;
        color: var(--text);
        text-decoration: underline;
        text-underline-offset: 0.2em;
        white-space: nowrap;
        &:focus:not(:focus-visible) {
          outline: none;
        }
        focus-ring();
        &:disabled {
          opacity: 1;
          color: var(--text);
          cursor: default;
        }
      }

      & .sold {
        visibility: hidden;
        color: var(--emphasis);
        &.is-sold {
          visibility: visible;
        }
      }
    }

    & > form > p {
      margin: 0;
      text-align: center;
    }

    & > form > p.shop-links {
      display: flex;
      gap: base-line * 0.5;
      align-items: baseline;

      & button {
        padding: 0;
        border: 0;
        background: none;
        color: var(--text);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
    }
  }
</style>
