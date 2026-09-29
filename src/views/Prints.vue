<script setup>
  import { computed, inject, onMounted as mounted, ref, watch } from 'vue'
  import AsFigure from '@/components/posters/as-figure'
  import { use_posters } from '@/use/poster'
  import { as_author } from '@/utils/itemid'
  import { load } from '@/utils/itemid'
  import { poster_ratio } from '@/use/poster-aspect'

  const { posters, for_person } = use_posters()
  const admin_id = import.meta.env.VITE_ADMIN_ID
  const contact_url = `sms:${admin_id.slice(1)}`
  const CENTS_PER_DOLLAR = 100
  const OPEN_AMOUNT = 50000
  const PRINT_LIMIT = 21

  const prints = computed(() =>
    posters.value
      .filter(p => as_author(p.id) === admin_id)
      .slice(0, PRINT_LIMIT)
  )

  // Every print covers the same area, so the shop weighs them equally and a
  // tall poster does not shout over a wide one. The ratio decides the shape;
  // the width that keeps the area is CSS's half of the job.
  const shapes = ref(/** @type {Map<string, number>} */ (new Map()))

  // Stripe reports which editions of the selected poster have sold. The $500
  // edition remains available after any number of sales.
  const amounts = ref(/** @type {number[]} */ ([]))
  const sold = ref(/** @type {number[]} */ ([]))
  const loading_editions = ref(false)
  const currency = ref('usd')

  const as_money = (amount, code) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (code || 'usd').toUpperCase(),
      maximumFractionDigits: 0
    }).format(amount / CENTS_PER_DOLLAR)

  const load_editions = async poster_id => {
    amounts.value = []
    sold.value = []
    loading_editions.value = true
    try {
      const res = await fetch(
        `/prints-checkout?poster_id=${encodeURIComponent(poster_id)}`
      )
      if (!res.ok) return
      const data = await res.json()
      if (
        showing.value !== poster_id ||
        !Array.isArray(data.amounts) ||
        !Array.isArray(data.sold)
      )
        return
      amounts.value = data.amounts
      sold.value = data.sold
      if (data.currency) currency.value = data.currency
    } catch {
      // An unavailable quote must not offer a checkout at a guessed price.
    } finally {
      if (showing.value === poster_id) loading_editions.value = false
    }
  }

  const hydrate = async () => {
    const loaded = await Promise.all(
      prints.value.map(p =>
        load(p.id).then(item => ({
          id: p.id,
          ratio: poster_ratio(item?.viewbox)
        }))
      )
    )
    shapes.value = new Map(loaded.map(({ id, ratio }) => [id, ratio]))
  }

  mounted(async () => {
    await for_person({ id: import.meta.env.VITE_ADMIN_ID })
    await hydrate()
  })

  // Sync can change poster dimensions while this page is open.
  const feed_needs_refresh = inject(
    'feed_needs_refresh',
    /** @type {import('vue').Ref<{ at: number } | null> | null} */ (null)
  )
  watch(
    () => feed_needs_refresh?.value?.at,
    () => void hydrate()
  )

  const viewer = ref(/** @type {HTMLDialogElement | null} */ (null))
  const showing = ref('')
  const buy_error = ref('')

  const open = poster_id => {
    showing.value = poster_id
    buy_error.value = ''
    load_editions(poster_id)
    viewer.value?.showModal()
  }

  // Touch the art to close; the edition list stays interactive.
  const on_click = event => {
    if (event.target.closest('form')) return
    viewer.value.close()
    showing.value = ''
  }

  const buying = ref('')

  const buy = async (poster_id, amount) => {
    if (
      buying.value ||
      !amounts.value.includes(amount) ||
      (amount !== OPEN_AMOUNT && sold.value.includes(amount))
    )
      return
    buying.value = poster_id
    buy_error.value = ''
    try {
      const res = await fetch('/prints-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poster_id, amount })
      })
      // A 5xx from the function is JSON, a dev-server 404 is HTML - only the
      // former parses, so a failed parse is itself a failure, not a crash.
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        buy_error.value = data.error || 'Checkout unavailable'
        return
      }
      if (data.url) window.location.href = data.url
      else buy_error.value = 'Checkout unavailable'
    } catch {
      buy_error.value = 'Checkout unavailable'
    } finally {
      buying.value = ''
    }
  }
</script>

<template>
  <section id="prints" data-page>
    <h1>Hand-finished prints</h1>
    <p>
      A print is a poster taken further &mdash; finished by hand, shipped to
      you.
    </p>

    <ol v-if="prints.length" role="feed">
      <li
        v-for="p in prints"
        :key="p.id"
        :style="{ '--ratio': shapes.get(p.id) ?? 1 }">
        <!--
          The print is the control. The button brings its own focus ring,
          and Enter key, so nothing sits on the art to make it reachable.
        -->
        <button type="button" aria-label="Open this print" @click="open(p.id)">
          <as-figure :itemid="p.id" />
        </button>
      </li>
    </ol>

    <!--
      Click into a print and it is the print, as big as the window allows,
      with its edition list below.
    -->
    <dialog
      ref="viewer"
      data-modal
      aria-label="Hand-finished print"
      :style="{ '--ratio': shapes.get(showing) ?? 1 }"
      @click="on_click">
      <!--
        `pin` because two renderings of one poster share a single loaded
        record: an unpinned copy that mounts before it is on screen deletes
        the cutout flags off that record, and the copy in the grid behind
        this one goes blank.
      -->
      <as-figure v-if="showing" :key="showing" :itemid="showing" pin />
      <form @submit.prevent>
        <ol v-if="amounts.length">
          <li v-for="amount in amounts" :key="amount">
            <button
              type="button"
              :disabled="amount !== OPEN_AMOUNT && sold.includes(amount)"
              :aria-busy="buying === showing"
              @click="buy(showing, amount)">
              <data :value="amount">{{ as_money(amount, currency) }}</data>
              <span v-if="sold.includes(amount)" aria-label="Sold"
                >&#9679;</span
              >
            </button>
          </li>
        </ol>
        <p v-if="buy_error" role="alert">{{ buy_error }}</p>
        <p v-else-if="loading_editions" role="status">Checking editions</p>
        <p v-else-if="!amounts.length" role="status">Checkout unavailable</p>
        <a
          v-if="buy_error || (!loading_editions && !amounts.length)"
          :href="contact_url"
          >Message the artist</a
        >
      </form>
    </dialog>
  </section>
</template>

<style lang="stylus">
  section#prints {
    // The side of the square every print covers. Each poster keeps its own
    // shape - a landscape print comes out wider and shorter than a portrait
    // one - and width times height lands on the same number either way.
    --print-unit: clamp(base-line * 11, 33vw, base-line * 17);
    @media (max-width: pad-begins) {
      --print-unit: 76vw;
    }

    & > p {
      max-width: page-width;
      margin: 0 auto base-line * 2;
      padding-inline: base-line;
      text-align: center;
    }

    // Not a grid: equal area means every print is a different width, and no
    // column can hold widths that differ. They flow instead, and a short row
    // sits centred rather than stranded left.
    & > ol[role='feed'] {
      display: flex;
      flex-wrap: wrap;
      // Equal area means a row holds a short landscape print beside a tall
      // portrait one. Centring splits the leftover height above and below
      // instead of hanging every short print from the same line.
      align-items: center;
      justify-content: center;
      gap: base-line;
      padding: 0 base-line base-line * 2;

      & > li {
        flex: 0 0 auto;
        width: calc(var(--print-unit) * sqrt(var(--ratio, 1)));
        max-width: 100%;
        aspect-ratio: var(--ratio, 1);
        // The posters land in one batch, so this is a single settle from
        // square silhouettes to their real shapes, not a per-poster twitch.
        transition:
          width duration-reveal ease-settle,
          aspect-ratio duration-reveal ease-settle;
        @media (prefers-reduced-motion: reduce) {
          transition-duration: 0.01ms;
        }

        // Everything the shared button treatment adds - pill border, padding,
        // capitalised label, a faded disabled state - is chrome on a
        // photograph. The print is the only thing to look at.
        & > button {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          padding: 0;
          border: 0;
          border-radius: round((base-line / 3), 2);
          background: none;
          cursor: pointer;
          // Nothing moves on hover. A print on a wall does not hop when you
          // walk up to it, and the pointer already says the whole thing is
          // the control. The keyboard still gets a ring, having no cursor
          // to read.
          focus-ring();
          &:active {
            transform: none;
          }

          // The art is not a control, the button around it is. Left alone the
          // poster eats the click to toggle its own crop.
          & > figure,
          & > figure * {
            pointer-events: none;
          }

          & > figure {
            width: 100%;
            height: 100%;
            min-height: 0;
            grid-column: auto;
            grid-row: auto;
            border-radius: round((base-line / 3), 2);

            & > label > svg[itemid],
            & > svg[itemid] {
              height: 100%;
              min-height: 0;
              max-height: none;
            }
          }
        }
      }
    }

    & > dialog[data-modal] {
      display: grid;
      &:not([open]) {
        display: none;
      }
      justify-items: center;
      gap: base-line;
      padding: base-line;
      // The house dialog wears a clay frame. Around a photograph it reads as
      // a second, louder picture frame, so this one is just a surface.
      border: 0;

      & > form {
        display: grid;
        justify-items: center;
        gap: base-line * 0.5;
        width: auto;

        & > ol {
          display: grid;
          gap: base-line * 0.25;
          padding: 0;
          list-style: none;

          & button {
            min-width: 0;
            padding: 0;
            border: 0;
            background: none;
            color: var(--text);
            text-decoration: underline;
            text-underline-offset: 0.2em;
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

          & span[aria-label='Sold'] {
            margin-inline-start: base-line * 0.25;
            color: var(--emphasis);
          }
        }

        & > p {
          margin: 0;
          text-align: center;
        }
      }

      & > figure {
        // The same trade as the grid: a height budget and the poster's ratio
        // decide the width, so nothing crops and nothing overflows.
        // unquote: Stylus owns `min()` and cannot coerce a calc into it.
        width: unquote('min(88vw, calc(52vh * var(--ratio, 1)))');
        aspect-ratio: var(--ratio, 1);
        min-height: 0;
        grid-column: auto;
        grid-row: auto;
        border-radius: round((base-line / 3), 2);

        & > label > svg[itemid],
        & > svg[itemid] {
          height: 100%;
          min-height: 0;
          max-height: none;
        }
      }

      // A press on the art reaches the dialog, and the dialog closes.
      & > figure,
      & > figure * {
        pointer-events: none;
      }
    }
  }
</style>
