<script setup>
  import { computed, onMounted as mounted, ref } from 'vue'
  import AsFigure from '@/components/posters/as-figure'
  import { use_posters } from '@/use/poster'
  import { as_author } from '@/utils/itemid'
  import { load } from '@/utils/itemid'
  import { poster_ratio } from '@/use/poster-aspect'

  const { posters, for_person } = use_posters()
  const admin_id = import.meta.env.VITE_ADMIN_ID

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

  mounted(async () => {
    await for_person({ id: import.meta.env.VITE_ADMIN_ID })
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
    sold.value = new Map(loaded.map(({ id, date }) => [id, date]))
    shapes.value = new Map(loaded.map(({ id, ratio }) => [id, ratio]))
  })

  const working = ref(false)

  const buy = async poster_id => {
    working.value = true
    try {
      const res = await fetch('/prints-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poster_id })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      working.value = false
    }
  }
</script>

<template>
  <section id="prints" data-page>
    <header>
      <h1>Hand-finished prints</h1>
      <p>
        A print is a poster taken further &mdash; finished by hand, shipped to
        you. The first is $5. The second is $100. Every one after is $500.
      </p>
    </header>

    <ol v-if="prints.length" role="feed">
      <li
        v-for="p in prints"
        :key="p.id"
        :style="{ '--ratio': shapes.get(p.id) ?? 1 }">
        <as-figure :itemid="p.id" menu menu-always-visible>
          <menu>
            <li v-if="sold.get(p.id)">
              <time :datetime="sold.get(p.id)">sold</time>
            </li>
            <li v-else>
              <button
                :aria-busy="working"
                @click="buy(p.id)"
                aria-label="Buy this print">
                Buy
              </button>
            </li>
          </menu>
        </as-figure>
      </li>
    </ol>
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

    & > header {
      padding: base-line * 2;
      & > p {
        max-width: page-width;
      }
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

        & > figure {
          border-radius: base-line / 3;
          // The shared figure widens landscape posters across two or three
          // columns and floors every poster at 512px tall. Here the print's
          // own box already says how big it is.
          grid-column: auto;
          grid-row: auto;
          width: 100%;
          height: 100%;
          min-height: 0;

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
</style>
