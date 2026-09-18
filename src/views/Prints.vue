<script setup>
  import { computed, inject, onMounted as mounted, ref, watch } from 'vue'
  import AsFigure from '@/components/posters/as-figure'
  import { use_posters } from '@/use/poster'
  import { as_author } from '@/utils/itemid'
  import { load } from '@/utils/itemid'
  import { poster_ratio } from '@/use/poster-aspect'

  const { posters, for_person } = use_posters()
  const admin_id = import.meta.env.VITE_ADMIN_ID
  const CENTS_PER_DOLLAR = 100

  const prints = computed(() =>
    posters.value.filter(p => as_author(p.id) === admin_id)
  )

  // Sale records live inside each poster's own HTML (`<metadata itemprop="sale">`).
  // `posters` carries only id/type stubs, so hydrate the sale state per poster.
  // `sale` is the record for a single sale, an array once more sell.
  const sold = ref(/** @type {Map<string, string>} */ (new Map()))

  // Every print covers the same area, so the shop weighs them equally and a
  // tall poster does not shout over a wide one. The ratio decides the shape;
  // the width that keeps the area is CSS's half of the job.
  const shapes = ref(/** @type {Map<string, number>} */ (new Map()))

  // The ladder is global - the first print sold anywhere is $5, the second
  // $100, every one after that $500 - and Stripe is the one counting. Ask the
  // checkout function instead of re-deriving the tier from the prints on this
  // page: a sale can be missing from the list, and realness-ops owns the
  // ladder. Null until the answer lands, so we never show a number we guessed.
  const price = ref(/** @type {number | null} */ (null))
  const currency = ref('usd')

  const as_money = (amount, code) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (code || 'usd').toUpperCase(),
      maximumFractionDigits: 0
    }).format(amount / CENTS_PER_DOLLAR)

  const load_price = async () => {
    try {
      const res = await fetch('/prints-checkout')
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.amount !== 'number') return
      price.value = data.amount
      if (data.currency) currency.value = data.currency
    } catch {
      // The dev server has no functions. The checkout POST still charges the
      // ladder's real price, so a missing label is safe; a wrong one is not.
    }
  }

  const hydrate = async () => {
    const loaded = await Promise.all(
      prints.value.map(p =>
        load(p.id).then(item => {
          const sale = item?.sale
          const first = Array.isArray(sale) ? sale[0] : sale
          return {
            id: p.id,
            date: first?.date ?? '',
            ratio: poster_ratio(item?.viewbox)
          }
        })
      )
    )
    sold.value = new Map(
      loaded.filter(({ date }) => date).map(({ id, date }) => [id, date])
    )
    shapes.value = new Map(loaded.map(({ id, ratio }) => [id, ratio]))
  }

  mounted(async () => {
    load_price()
    await for_person({ id: import.meta.env.VITE_ADMIN_ID })
    await hydrate()
  })

  // Sync drops a poster's cached html when its stored hash moves (a sale), then
  // says so here. Re-reading is what turns the button into a sold dot without a
  // page reload.
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
    // The tier can have moved since the page loaded. One cheap GET keeps the
    // label honest against what Stripe will charge.
    load_price()
    viewer.value?.showModal()
  }

  // Touch anything in here but the price and the print closes, which saves
  // drawing an X. The poster paints layers that take pointer events of their
  // own, so this asks what the press was not - the buy form - instead of
  // testing for the dialog itself.
  const on_click = event => {
    if (event.target.closest('form')) return
    viewer.value.close()
    showing.value = ''
  }

  const buying = ref('')

  const buy = async poster_id => {
    if (buying.value) return
    buying.value = poster_id
    buy_error.value = ''
    try {
      const res = await fetch('/prints-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poster_id })
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
          Enter key and disabled state, so nothing has to sit on top of the
          art to make it reachable.
        -->
        <button
          type="button"
          :disabled="sold.has(p.id)"
          :aria-label="sold.has(p.id) ? 'Sold' : 'Open this print'"
          @click="open(p.id)">
          <as-figure :itemid="p.id" />
        </button>
      </li>
    </ol>

    <!--
      Click into a print and it is the print, as big as the window allows,
      with one control wearing the price.
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
      <form @submit.prevent="buy(showing)">
        <button type="submit" :aria-busy="buying === showing">
          <data v-if="price !== null" :value="price">{{
            as_money(price, currency)
          }}</data>
          <template v-else>Buy</template>
        </button>
        <p v-if="buy_error" role="alert">{{ buy_error }}</p>
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

          // A red dot in the corner, the way a gallery marks a sold work. It
          // says everything the word said, in a glance, at any size.
          &:disabled {
            opacity: 1;
            cursor: default;
            &::after {
              content: '';
              position: absolute;
              // The poster's svg carries z-index 1, so the dot has to climb
              // over it or it hangs behind the art.
              z-index: 2;
              top: base-line * 0.5;
              right: base-line * 0.5;
              width: base-line * 0.5;
              height: base-line * 0.5;
              border-radius: 50%;
              background-color: var(--emphasis);
            }
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
      justify-items: center;
      gap: base-line;
      padding: base-line;
      // The house dialog wears a clay frame. Around a photograph it reads as
      // a second, louder picture frame, so this one is just a surface.
      border: 0;

      & > form {
        width: auto;
      }

      & > figure {
        // The same trade as the grid: a height budget and the poster's ratio
        // decide the width, so nothing crops and nothing overflows.
        // unquote: Stylus owns `min()` and cannot coerce a calc into it.
        width: unquote('min(88vw, calc(64vh * var(--ratio, 1)))');
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
