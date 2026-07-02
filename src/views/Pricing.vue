<script setup>
  import SiteNav from '@/components/site-nav'
  import AsPromptAgent from '@/components/as-prompt-agent.vue'
  import SponsorCta from '@/components/sponsor/cta'

  defineOptions({ name: 'Pricing' })
</script>

<template>
  <section id="pricing" class="page">
    <header>
      <site-nav />
    </header>
    <article>
      <header>
        <h1>Pricing</h1>
        <p>
          Realness is free to use. It costs $5, and stays free to use. License
          Realness for small teams and large organizations.
        </p>
      </header>

      <ul>
        <li>
          <article>
            <h2>Free to use</h2>
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
                <strong>Commercial use</strong>
                <p>Use posters in client and commercial work.</p>
              </li>
            </ul>
            <p>
              <strong>$5</strong>
              <span>Endorse</span>
            </p>
            <menu>
              <sponsor-cta />
            </menu>
          </article>
        </li>

        <li>
          <article>
            <h2>Small teams</h2>
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
                <p>Thoughts, statements, and a phonebook for your community.</p>
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
            <p>
              <strong>$100</strong>
              <span>per year</span>
            </p>
            <menu>
              <sponsor-cta buy_button_id="buy_btn_0ToWtGANizuvdTZsdZR8DZkz" />
            </menu>
            <menu class="actions">
              <as-prompt-agent mode="instance" inline />
              <a href="https://github.com/realness-online/web" rel="external">
                Contact us
              </a>
            </menu>
          </article>
        </li>

        <li>
          <article>
            <h2>Large organizations</h2>
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
            <p>
              <strong>$500</strong>
              <span>per year</span>
            </p>
            <menu>
              <sponsor-cta buy_button_id="buy_btn_0ToWseANizuvdTZsaqi4BZws" />
            </menu>
            <menu class="actions">
              <as-prompt-agent mode="instance" inline />
              <a href="https://github.com/realness-online/web" rel="external">
                Contact us
              </a>
            </menu>
          </article>
        </li>
      </ul>
    </article>
  </section>
</template>

<style lang="stylus">
  section#pricing.page {
    width: 100%;
    max-width: none;
    margin: 0;
    box-sizing: border-box;

    & > header {
      display: block;
      padding: 0;
      margin-bottom: base-line;
    }

    & > article {
      & > header {
        display: block;
        text-align: center;
        margin-bottom: base-line * 2;

        & > h1 {
          margin: 0 0 (base-line * 0.5);
          color: blue;
        }

        & > p {
          margin: 0;
          max-width: base-line * 22;
          margin-inline: auto;
        }
      }

      & > ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: base-line;

        @media (min-width: pad-begins) {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: stretch;
        }

        & > li {
          margin: 0;
          padding: 0;
          min-width: 0;

          & > article {
            height: 100%;
            display: flex;
            flex-direction: column;
            padding: base-line;
            border: round((base-line * 0.1), 2) solid var(--blue);
            border-radius: base-line * 0.5;
            background-color: var(--surface);
            box-sizing: border-box;

            & > h2 {
              margin: 0 0 (base-line * 0.35);
              color: blue;
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
              flex: 1;

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
                  background-color: var(--blue);
                }

                & > strong {
                  display: block;
                  color: blue;
                }

                & > p {
                  margin: (base-line * 0.15) 0 0;
                  font-size: 0.9em;
                  opacity: 0.88;
                  line-height: 1.4;
                }
              }
            }

            & > p:has(> strong) {
              margin: 0 0 (base-line * 0.35);
              line-height: 1.2;
              text-align: center;

              & > strong {
                font-size: base-line * 1.75;
                color: blue;
                font-weight: 300;
              }

              & > span {
                display: block;
                font-size: 0.9em;
                margin-top: base-line * 0.15;
              }
            }

            & > p:has(> strong) + p {
              margin: 0 0 base-line;
              font-size: 0.85em;
              opacity: 0.85;
              line-height: 1.4;
              text-align: center;
            }

            & > menu {
              display: flex;
              justify-content: center;
              margin: 0;
              padding: 0;
            }

            & > menu.actions {
              gap: base-line * 0.5;
              margin-top: auto;

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
                border: round((base-line * 0.1), 2) solid var(--red);
                background: none;
                color: var(--red);

                &:hover,
                &:focus-visible {
                  background: var(--red);
                  color: white;
                }
              }

              & > a {
                border: round((base-line * 0.1), 2) solid var(--blue);
                color: blue;

                &:hover,
                &:focus-visible {
                  background-color: alpha(blue-fill, 0.12);
                }
              }
            }

            & > a {
              display: block;
              text-align: center;
              padding: base-line * 0.5 base-line;
              border: round((base-line * 0.1), 2) solid var(--blue);
              border-radius: base-line * 0.33;
              color: blue;
              font-weight: bold;
              text-decoration: none;
              margin-top: auto;

              &:hover,
              &:focus-visible {
                background-color: alpha(blue-fill, 0.12);
              }
            }
          }
        }
      }
    }
  }
</style>
