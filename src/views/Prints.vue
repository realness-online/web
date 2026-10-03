<script setup>
  import { computed, inject, onMounted as mounted, ref, watch } from 'vue'
  import AsFigure from '@/components/posters/as-figure'
  import { use_posters } from '@/use/poster'
  import { as_author, load } from '@/utils/itemid'
  import { poster_ratio } from '@/use/poster-aspect'

  const { posters, for_person } = use_posters()
  const admin_id = import.meta.env.VITE_ADMIN_ID
  const PRINT_LIMIT = 21

  // The last segment of the poster id is the print's own address, the same one
  // a sale page and a share link use.
  const print_url = poster_id => `/prints/${poster_id.split('/').at(-1)}`

  const prints = computed(() =>
    posters.value
      .filter(p => as_author(p.id) === admin_id)
      .slice(0, PRINT_LIMIT)
  )

  // Every print covers the same area, so the shop weighs them equally and a
  // tall poster does not shout over a wide one. The ratio decides the shape;
  // the width that keeps the area is CSS's half of the job.
  const shapes = ref(/** @type {Map<string, number>} */ (new Map()))

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
    await for_person({ id: admin_id })
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
        <router-link :to="print_url(p.id)" :aria-label="'Open print ' + p.id">
          <as-figure :itemid="p.id" />
        </router-link>
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

        // Everything the shared link treatment adds - pill border, padding,
        // capitalised label, a faded disabled state - is chrome on a
        // photograph. The print is the only thing to look at.
        & > a {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          padding: 0;
          border: 0;
          border-radius: round((base-line / 3), 2);
          background: none;
          cursor: pointer;
          color: inherit;
          text-decoration: none;
          // Nothing moves on hover. A print on a wall does not hop when you
          // walk up to it, and the pointer already says the whole thing is
          // the control. The keyboard still gets a ring, having no cursor
          // to read.
          focus-ring();
          &:active {
            transform: none;
          }

          // The art is not a control, the link around it is. Left alone the
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
  }
</style>
