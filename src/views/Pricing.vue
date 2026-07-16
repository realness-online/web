<script setup>
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import AsPromptAgent from '@/components/as-prompt-agent.vue'
  import SponsorCta from '@/components/sponsor/cta'

  defineOptions({ name: 'Pricing' })

  const route = useRoute()
  const router = useRouter()

  // Order of tiers as they appear in the template — used only to drive
  // which one is active, never to generate content.
  const tier_slugs = ['endorse', 'teams', 'enterprise']

  const slug_index = slug => tier_slugs.indexOf(slug)
  const active_index = ref(0)
  const active_slug = computed(() => tier_slugs[active_index.value])

  const sync_from_route = () => {
    const slug = route?.params?.tier
    const index = slug ? slug_index(slug) : -1
    active_index.value = index === -1 ? 0 : index
  }
  sync_from_route()
  watch(() => route?.params?.tier, sync_from_route)

  const go_to = index => {
    const wrapped = (index + tier_slugs.length) % tier_slugs.length
    active_index.value = wrapped
    const slug = tier_slugs[wrapped]
    if (route?.params?.tier !== slug && router)
      router.replace(`/pricing/${slug}`)
  }
  const next = () => go_to(active_index.value + 1)
  const prev = () => go_to(active_index.value - 1)

  // Swipe between tiers on touch.
  let touch_start_x = null
  const on_touch_start = event => {
    touch_start_x = event.changedTouches[0]?.clientX ?? null
  }
  const on_touch_end = event => {
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
    data-page
    @touchstart.passive="on_touch_start"
    @touchend.passive="on_touch_end">
    <article>
      <header>
        <h1>Pricing</h1>
        <p>Realness is free to use — but it has a price.</p>
      </header>

      <nav aria-label="Pricing tiers">
        <router-link
          to="/pricing/endorse"
          :aria-current="active_slug === 'endorse' ? 'page' : undefined">
          Endorse
        </router-link>
        <router-link
          to="/pricing/teams"
          :aria-current="active_slug === 'teams' ? 'page' : undefined">
          Teams
        </router-link>
        <router-link
          to="/pricing/enterprise"
          :aria-current="active_slug === 'enterprise' ? 'page' : undefined">
          Organizations
        </router-link>
      </nav>

      <section aria-label="Tier carousel">
        <transition name="slide" mode="out-in">
          <article v-if="active_slug === 'endorse'" key="endorse">
            <h2>Endorse</h2>
            <p>For anyone making posters on the web.</p>
            <ul>
              <li>
                <strong>Photo to poster</strong>
                <p>
                  Camera, paste, or pick an image. Vector layers stay on your
                  device.
                </p>
              </li>
              <li>
                <strong>Mosaics</strong>
                <p>Transparent cutouts from contrast in your photo.</p>
              </li>
              <li>
                <strong>Shadow layers</strong>
                <p>Gradients and strokes across eighteen colors per image.</p>
              </li>
              <li>
                <strong>Export</strong>
                <p>SVG, 4K PNG, layered PSD, video, or GLB.</p>
              </li>
              <li>
                <strong>Thoughts feed</strong>
                <p>Everyone's posters and statements, together.</p>
              </li>
              <li>
                <strong>Talk off-app</strong>
                <p>
                  Your number lets people reach you in the messenger you already
                  use.
                </p>
              </li>
              <li>
                <strong>Commercial use</strong>
                <p>Use posters in client and commercial work.</p>
              </li>
            </ul>
            <menu>
              <sponsor-cta buy_button_id="buy_btn_0TTXvPANizuvdTZsWfCGhEHG" />
            </menu>
          </article>
          <article v-else-if="active_slug === 'teams'" key="teams">
            <h2>Teams</h2>
            <p>
              Design studios, consultants, families; intimate creative work.
            </p>
            <ul>
              <li>
                <strong>Your Realness</strong>
                <p>Run an instance for your studio, family, or circle.</p>
              </li>
              <li>
                <strong>One community</strong>
                <p>One moderator with clear responsibility.</p>
              </li>
              <li>
                <strong>Local posters</strong>
                <p>
                  Members create art on their device; The philosophy is client
                  first. Realness is reliable and efficient to serve.
                </p>
              </li>
              <li>
                <strong>Shared tools</strong>
                <p>Thoughts, statements, and people you can reach by phone.</p>
              </li>
              <li>
                <strong>Talk off-app</strong>
                <p>
                  Members keep talking in messengers they already use. Your
                  instance is for presence.
                </p>
              </li>
              <li>
                <strong>No per-seat pricing</strong>
                <p>License the group, not every login.</p>
              </li>
              <li>
                <strong>Commercial use</strong>
                <p>Allowed for your organization.</p>
              </li>
            </ul>
            <menu>
              <sponsor-cta buy_button_id="buy_btn_0ToWtGANizuvdTZsdZR8DZkz" />
            </menu>
            <menu aria-label="Actions">
              <as-prompt-agent mode="instance" inline />
              <a href="https://github.com/realness-online/web" rel="external">
                Contact us
              </a>
            </menu>
          </article>
          <article v-else key="enterprise">
            <h2>Organizations</h2>
            <p>For companies and institutions running Realness at scale.</p>
            <ul>
              <li>
                <strong>Many communities</strong>
                <p>License Realness across teams and institutions.</p>
              </li>
              <li>
                <strong>Governance</strong>
                <p>Moderation that scales with your organization.</p>
              </li>
              <li>
                <strong>Same workflow</strong>
                <p>Posters, exports, and shortcuts for every member.</p>
              </li>
              <li>
                <strong>Talk off-app</strong>
                <p>
                  People connect by phone and keep talking in messengers they
                  already use.
                </p>
              </li>
              <li>
                <strong>Scale hosting</strong>
                <p>Capacity for distributed orgs and large groups.</p>
              </li>
              <li>
                <strong>No per-seat pricing</strong>
                <p>License the organization, not headcount.</p>
              </li>
              <li>
                <strong>Commercial use</strong>
                <p>Allowed across licensed communities.</p>
              </li>
            </ul>
            <menu>
              <sponsor-cta buy_button_id="buy_btn_0ToWseANizuvdTZsaqi4BZws" />
            </menu>
            <menu aria-label="Actions">
              <as-prompt-agent mode="instance" inline />
              <a href="https://github.com/realness-online/web" rel="external">
                Contact us
              </a>
            </menu>
          </article>
        </transition>
      </section>
    </article>
  </section>
</template>

<style lang="stylus">
  section#pricing[data-page] {
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
          margin-top: 0;
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
          padding: 0 base-line * 0.75;
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
        touch-action: pan-y;

        & > article {
          display: flex;
          flex-direction: column;
          padding: base-line;
          border: round((base-line * 0.1), 2) solid var(--accent);
          border-radius: base-line * 0.5;
          background-color: var(--surface);
          box-sizing: border-box;

          & > h2 {
            margin-top: 0;
            color: var(--accent);
            font-size: larger;
          }

          & > h2 + p {
            line-height: 1.45;
          }

          & > ul {
            list-style: none;
            margin-bottom: base-line;

            & > li {
              margin-bottom: base-line;
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
                margin: 0;
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
            // Reserve the buy-button height so the card doesn't reflow when
            // Stripe's iframe loads.
            min-height: 223px;
          }

          & > menu[aria-label='Actions'] {
            gap: base-line * 0.5;
            margin-top: base-line;

            & > button,
            & > a {
              flex: 1;
              display: block;
              text-align: center;
              padding: base-line;
              border-radius: base-line * 0.33;
              font-weight: bold;
              text-decoration: none;
              font: inherit;
              cursor: pointer;
            }

            & > button {
              border: round((base-line * 0.1), 2) solid var(--emphasis);
              background: none;
              color: var(--emphasis);

              &:hover,
              &:focus-visible {
                background: var(--emphasis);
                color: var(--contrast);
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
