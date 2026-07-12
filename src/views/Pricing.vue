<script setup>
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import AsPromptAgent from '@/components/as-prompt-agent.vue'
  import SponsorCta from '@/components/sponsor/cta'

  defineOptions({ name: 'Pricing' })

  const route = useRoute()
  const router = useRouter()

  // The Endorse tier uses the $5 Stripe buy button (the SponsorCta default);
  // the commercial tiers pass their own buy_button_id.
  const tiers = [
    {
      slug: 'endorse',
      title: 'Endorse',
      intro: 'For anyone making posters on the web.',
      features: [
        {
          strong: 'Photo to poster',
          p: 'Camera, paste, or pick an image. Vector layers stay on your device.'
        },
        {
          strong: 'Mosaics',
          p: 'Transparent cutouts from contrast in your photo.'
        },
        {
          strong: 'Shadow layers',
          p: 'Gradients and strokes across eighteen colors per image.'
        },
        {
          strong: 'Export',
          p: 'SVG, 4K PNG, layered PSD, video, or GLB.'
        },
        {
          strong: 'Thoughts feed',
          p: "Everyone's posters and statements, together."
        },
        {
          strong: 'Commercial use',
          p: 'Use posters in client and commercial work.'
        }
      ],
      buy_button_id: 'buy_btn_0TTXvPANizuvdTZsWfCGhEHG',
      has_actions: false
    },
    {
      slug: 'teams',
      title: 'Teams',
      intro: 'Design studios, consultants, families; intimate creative work.',
      features: [
        {
          strong: 'Your Realness',
          p: 'Run an instance for your studio, family, or circle.'
        },
        {
          strong: 'One community',
          p: 'One moderator with clear responsibility.'
        },
        {
          strong: 'Local posters',
          p: 'Members create art on their device; The philosophy is client first. Realness is reliable and efficient to serve.'
        },
        {
          strong: 'Shared tools',
          p: 'Thoughts, statements, and a phonebook for your community.'
        },
        {
          strong: 'No per-seat pricing',
          p: 'License the group, not every login.'
        },
        {
          strong: 'Commercial use',
          p: 'Allowed for your organization.'
        }
      ],
      buy_button_id: 'buy_btn_0ToWtGANizuvdTZsdZR8DZkz',
      has_actions: true
    },
    {
      slug: 'enterprise',
      title: 'Organizations',
      intro: 'For companies and institutions running Realness at scale.',
      features: [
        {
          strong: 'Many communities',
          p: 'License Realness across teams and institutions.'
        },
        {
          strong: 'Governance',
          p: 'Moderation that scales with your organization.'
        },
        {
          strong: 'Same workflow',
          p: 'Posters, exports, and shortcuts for every member.'
        },
        {
          strong: 'Scale hosting',
          p: 'Capacity for distributed orgs and large groups.'
        },
        {
          strong: 'No per-seat pricing',
          p: 'License the organization, not headcount.'
        },
        {
          strong: 'Commercial use',
          p: 'Allowed across licensed communities.'
        }
      ],
      buy_button_id: 'buy_btn_0ToWseANizuvdTZsaqi4BZws',
      has_actions: true
    }
  ]

  const slug_index = slug => tiers.findIndex(tier => tier.slug === slug)
  const active_index = ref(0)

  const sync_from_route = () => {
    const slug = route?.params?.tier
    const index = slug ? slug_index(slug) : -1
    active_index.value = index === -1 ? 0 : index
  }
  sync_from_route()
  watch(() => route?.params?.tier, sync_from_route)

  const active_tier = computed(() => tiers[active_index.value])

  const go_to = index => {
    const wrapped = (index + tiers.length) % tiers.length
    active_index.value = wrapped
    const { slug } = tiers[wrapped]
    if (route?.params?.tier !== slug && router)
      router.replace(`/pricing/${slug}`)
  }
  const next = () => go_to(active_index.value + 1)
  const prev = () => go_to(active_index.value - 1)

  // Swipe between tiers on touch.
  let touch_start_x = null
  const onTouchStart = event => {
    touch_start_x = event.changedTouches[0]?.clientX ?? null
  }
  const onTouchEnd = event => {
    if (touch_start_x === null) return
    const delta = event.changedTouches[0].clientX - touch_start_x
    touch_start_x = null
    const THRESHOLD = 40
    if (delta > THRESHOLD) prev()
    else if (delta < -THRESHOLD) next()
  }
</script>

<template>
  <section
    id="pricing"
    class="page"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd">
    <article>
      <header>
        <h1>Pricing</h1>
        <p>
          Realness is free to use. It costs $5, and stays free to use, with paid
          tiers for teams and organizations.
        </p>
      </header>

      <nav aria-label="Pricing tiers">
        <router-link
          v-for="(tier, index) in tiers"
          :key="tier.slug"
          :to="`/pricing/${tier.slug}`"
          :aria-current="index === active_index ? 'page' : undefined">
          {{ tier.title }}
        </router-link>
      </nav>

      <section aria-label="Tier carousel">
        <button type="button" aria-label="Previous tier" @click="prev">
          ‹
        </button>
        <transition name="slide" mode="out-in">
          <article :key="active_tier.slug">
            <h2>{{ active_tier.title }}</h2>
            <p>{{ active_tier.intro }}</p>
            <ul>
              <li v-for="feature in active_tier.features" :key="feature.strong">
                <strong>{{ feature.strong }}</strong>
                <p>{{ feature.p }}</p>
              </li>
            </ul>
            <menu>
              <sponsor-cta :buy_button_id="active_tier.buy_button_id" />
            </menu>
            <menu v-if="active_tier.has_actions" aria-label="Actions">
              <as-prompt-agent mode="instance" inline />
              <a href="https://github.com/realness-online/web" rel="external">
                Contact us
              </a>
            </menu>
          </article>
        </transition>
        <button type="button" aria-label="Next tier" @click="next">›</button>
      </section>
    </article>
  </section>
</template>

<style lang="stylus">
  section#pricing.page {
    width: 100%;
    max-width: none;
    margin: 0;
    box-sizing: border-box;
    padding-inline: base-line;
    padding-bottom: base-line * 4;

    & > article {
      max-width: base-line * 28;
      margin-inline: auto;

      & > header {
        display: block;
        text-align: center;
        margin-bottom: base-line * 1.5;

        & > h1 {
          margin: 0 0 (base-line * 0.5);
          color: var(--accent);
        }

        & > p {
          margin: 0;
          max-width: base-line * 22;
          margin-inline: auto;
        }
      }

      // Tier navigation — jump to any tier, position shown by aria-current.
      & > nav[aria-label='Pricing tiers'] {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: base-line * 0.5;
        margin-bottom: base-line * 1.5;

        & > a {
          padding: base-line * 0.25 base-line * 0.75;
          border-radius: base-line * 0.33;
          color: var(--accent);
          text-decoration: none;
          font-weight: bold;
          border: round((base-line * 0.1), 2) solid transparent;
          opacity: 0.7;

          &:hover,
          &:focus-visible {
            opacity: 1;
            border-color: var(--accent);
          }

          &[aria-current] {
            opacity: 1;
            background-color: unquote('color-mix(in srgb, var(--accent) 12%, transparent)');
            border-color: var(--accent);
          }
        }
      }

      & > section[aria-label='Tier carousel'] {
        display: flex;
        align-items: center;
        gap: base-line * 0.5;
        touch-action: pan-y;

        & > button[aria-label='Previous tier'],
        & > button[aria-label='Next tier'] {
          flex: none;
          width: base-line * 1.5;
          height: base-line * 1.5;
          border: round((base-line * 0.1), 2) solid var(--accent);
          border-radius: 50%;
          background: none;
          color: var(--accent);
          font-size: larger;
          line-height: 1;
          cursor: pointer;

          &:hover,
          &:focus-visible {
            background-color: unquote('color-mix(in srgb, var(--accent) 12%, transparent)');
          }
        }

        & > article {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          padding: base-line;
          border: round((base-line * 0.1), 2) solid var(--accent);
          border-radius: base-line * 0.5;
          background-color: var(--surface);
          box-sizing: border-box;

          & > h2 {
            margin: 0 0 (base-line * 0.35);
            color: var(--accent);
            font-size: larger;
          }

          & > h2 + p {
            margin: 0 0 base-line;
            line-height: 1.45;
          }

          & > ul {
            list-style: none;
            margin: 0 0 base-line;
            padding: 0;

            & > li {
              margin: 0 0 base-line;
              padding-left: base-line;
              position: relative;
              line-height: 1.4;

              &::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0.4em;
                width: base-line * 0.35;
                height: base-line * 0.35;
                border-radius: 50%;
                background-color: var(--accent);
              }

              & > strong {
                display: block;
                color: var(--accent);
              }

              & > p {
                margin: (base-line * 0.15) 0 0;
                font-size: 0.9em;
                opacity: 0.88;
                line-height: 1.4;
              }
            }
          }

          & > menu {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
            padding: 0;
            // Reserve the buy-button height so the card doesn't reflow when
            // Stripe's iframe loads.
            min-height: 223px;
          }

          & > menu[aria-label='Actions'] {
            gap: base-line * 0.5;
            margin-top: base-line;

            & > button.prompt-agent.inline,
            & > a {
              flex: 1;
              display: block;
              text-align: center;
              padding: base-line * 0.5 base-line;
              border-radius: base-line * 0.33;
              font-weight: bold;
              text-decoration: none;
              font: inherit;
              cursor: pointer;
            }

            & > button.prompt-agent.inline {
              border: round((base-line * 0.1), 2) solid var(--emphasis);
              background: none;
              color: var(--emphasis);

              &:hover,
              &:focus-visible {
                background: var(--emphasis);
                color: white;
              }
            }

            & > a {
              border: round((base-line * 0.1), 2) solid var(--accent);
              color: var(--accent);

              &:hover,
              &:focus-visible {
                background-color: unquote('color-mix(in srgb, var(--accent) 12%, transparent)');
              }
            }
          }
        }
      }
    }
  }

  // Vue transition hooks (framework mechanic, not a styling selector).
  // out-in: the old tier leaves before the new one enters, so the two never
  // compete for the same space. Short and gentle — only transform/opacity.
  .slide-enter-active {
    transition: opacity 0.22s var(--ease-drift-out, ease), transform 0.22s var(--ease-drift-out, ease);
  }
  .slide-leave-active {
    transition: opacity 0.16s var(--ease-drift-out, ease), transform 0.16s var(--ease-drift-out, ease);
  }
  .slide-enter-from {
    transform: translateX(1.5rem);
    opacity: 0;
  }
  .slide-leave-to {
    transform: translateX(-1.5rem);
    opacity: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .slide-enter-from,
    .slide-leave-to {
      transform: none;
    }
  }
</style>
