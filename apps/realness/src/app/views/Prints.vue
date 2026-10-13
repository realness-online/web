<script setup>
  import { computed, inject, onMounted as mounted, ref, watch } from 'vue'
  import AsFigure from '@/components/posters/as-figure'
  import { use_posters } from '@/use/poster'
  import { as_author, load } from '@/utils/itemid'
  import { poster_ratio } from '@/use/poster-aspect'

  const { posters, for_person } = use_posters()
  const admin_id = import.meta.env.VITE_ADMIN_ID
  const PRINT_LIMIT = 21

  const print_url = poster_id => `/prints/${poster_id.split('/').at(-1)}`

  const prints = computed(() =>
    posters.value
      .filter(p => as_author(p.id) === admin_id)
      .slice(0, PRINT_LIMIT)
  )

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

    & > ol[role='feed'] {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: base-line;
      padding: 0 base-line base-line * 2;

      & > li {
        flex: 0 0 auto;
        width: calc(var(--print-unit) * sqrt(var(--ratio, 1)));
        max-width: 100%;
        aspect-ratio: var(--ratio, 1);
        transition:
          width duration-reveal ease-settle,
          aspect-ratio duration-reveal ease-settle;
        @media (prefers-reduced-motion: reduce) {
          transition-duration: 0.01ms;
        }

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
          focus-ring();
          &:active {
            transform: none;
          }

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
