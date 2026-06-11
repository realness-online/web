<script setup>
  import AsFigure from '@/components/posters/as-figure'
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import CallToAction from '@/components/call-to-action'
  import LogoAsLink from '@/components/logo-as-link'
  import SiteNav from '@/components/site-nav'
  import { as_author } from '@/utils/itemid'
  import { balance_gallery_posters } from '@/utils/balance-gallery-posters'
  import { use_posters } from '@/use/poster'
  import {
    onMounted as mounted,
    onUnmounted as dismount,
    computed,
    ref,
    nextTick as tick
  } from 'vue'
  const { posters, for_person: posters_for_admin } = use_posters()
  const admin_id = import.meta.env.VITE_ADMIN_ID
  const admin_posters = computed(() =>
    posters.value.filter(p => as_author(p.id) === admin_id)
  )

  const ABOUT_FEATURED_POSTER_COUNT = 4

  const gallery_posters = ref([])

  const balance_gallery = async () => {
    const featured = admin_posters.value.slice(0, ABOUT_FEATURED_POSTER_COUNT)
    const sliced = admin_posters.value.slice(ABOUT_FEATURED_POSTER_COUNT)
    gallery_posters.value = await balance_gallery_posters(sliced, { featured })
  }

  /** @type {import('vue').Ref<HTMLElement | null>} */
  const about_el = ref(null)
  const about_ready = ref(false)
  const about_motion = ref(false)
  /** @type {IntersectionObserver | null} */
  let section_observer = null
  /** @type {ScrollRestoration | null} */
  let prior_scroll_restoration = null

  const SECTION_REVEAL_RATIO = 0.33
  const SECTION_REVEAL_INSET = 0.1
  const PERCENT = 100
  const reveal_sections = () =>
    Array.from(about_el.value?.children ?? []).filter(el =>
      el.hasAttribute('itemprop')
    )

  /** @param {Element} section */
  const reveal_trigger = section => {
    if (section.localName === 'article')
      return section.querySelector(':scope > section') ?? section
    if (section.getAttribute('itemprop') === 'gallery')
      return section.querySelector(':scope > header') ?? section
    if (section.getAttribute('itemprop') === 'features')
      return section.querySelector(':scope > ol > li:first-child') ?? section
    return section
  }

  /** @param {Element} section */
  const reveal_section = section => {
    if (section.classList.contains('revealed')) return
    section.classList.add('revealed')
    section_observer?.unobserve(reveal_trigger(section))
  }

  /** @param {Element} el */
  const section_in_view = el => {
    const rect = el.getBoundingClientRect()
    if (rect.height <= 0) return false
    const root_bottom = window.innerHeight * (1 - SECTION_REVEAL_INSET)
    const visible_top = Math.max(rect.top, 0)
    const visible_bottom = Math.min(rect.bottom, root_bottom)
    const visible = Math.max(0, visible_bottom - visible_top)
    return visible / rect.height >= SECTION_REVEAL_RATIO
  }

  const scroll_to_top = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  const connect_section_observer = () => {
    const sections = reveal_sections()
    const watched = sections.map(section => ({
      section,
      trigger: reveal_trigger(section)
    }))
    const section_by_trigger = new WeakMap(
      watched.map(({ section, trigger }) => [trigger, section])
    )

    watched.forEach(({ section, trigger }) => {
      if (section.classList.contains('revealed')) return
      if (section_in_view(trigger)) reveal_section(section)
    })

    if (typeof IntersectionObserver === 'undefined') {
      sections.forEach(reveal_section)
      return
    }

    section_observer?.disconnect()
    section_observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          const section = section_by_trigger.get(entry.target)
          if (section) reveal_section(section)
        })
      },
      {
        threshold: SECTION_REVEAL_RATIO,
        rootMargin: `0px 0px -${SECTION_REVEAL_INSET * PERCENT}% 0px`
      }
    )

    watched.forEach(({ section, trigger }) => {
      if (!section.classList.contains('revealed'))
        section_observer?.observe(trigger)
    })
  }

  const observe_sections = () => {
    about_motion.value = true
    // Pre-hide must paint before `.revealed` or enter animations are skipped.
    requestAnimationFrame(() => {
      requestAnimationFrame(connect_section_observer)
    })
  }

  mounted(async () => {
    if ('scrollRestoration' in history) {
      prior_scroll_restoration = history.scrollRestoration
      history.scrollRestoration = 'manual'
    }

    await posters_for_admin({ id: import.meta.env.VITE_ADMIN_ID })
    await balance_gallery()
    scroll_to_top()
    about_ready.value = true
    await tick()
    observe_sections()
  })

  dismount(() => {
    section_observer?.disconnect()
    if (prior_scroll_restoration !== null)
      history.scrollRestoration = prior_scroll_restoration
  })
</script>

<template>
  <section
    id="about"
    ref="about_el"
    class="page"
    itemscope
    itemtype="/about"
    :class="{ 'about-motion': about_motion }">
    <site-nav />
    <header>
      <section itemprop="hero">
        <header :class="{ 'about-ready': about_ready }">
          <h1>Realness</h1>
          <h3>online</h3>
          <h4>Creativity Lives With You</h4>
          <p itemprop="workflow-tools">
            With Realness, create expressive vector graphics from your drawings,
            designs, and photos. It works on your device and integrates with the
            tools you already use.
          </p>
          <p>
            Start in your browser, or
            <a href="#make-a-video"
              >add Realness to your home screen or desktop</a
            >
            - works like a native app, straight from the web. Your data lives
            with you.
          </p>
        </header>
        <as-figure v-if="admin_posters.length" :itemid="admin_posters[0]?.id" />
      </section>
    </header>
    <article itemprop="artists">
      <header><h2>Artists</h2></header>
      <section>
        <as-figure v-if="admin_posters.length" :itemid="admin_posters[1]?.id" />
        <footer>
          <p>
            There is no line work. Though a poster is ornate, it's still missing
            your hand. The constraints become a vast landscape for you to
            explore.
          </p>
          <p>
            Storyboards, collage, thumbnails. No AI in the toolchain. Realness
            is a clean slate for you to start.
          </p>
          <p>Everything is made locally. Sign in to sync devices.</p>
          <h4>
            Animators, designers, hand-coders - <strong>Realness</strong> was
            built for you.
          </h4>
        </footer>
      </section>
    </article>
    <article itemprop="communities">
      <header><h2>Churches, Punks, and Veterans</h2></header>
      <section>
        <as-figure v-if="admin_posters.length" :itemid="admin_posters[2]?.id" />
        <header>
          <h2>Shared values</h2>
          <p>
            Run your own Realness. Hosting yours stays simple - so you can free
            your data and build community together. One moderator, clear
            responsibility, built for trust. Use it with your family, union
            hall, or your
            <a href="https://youtu.be/05YRMHWtv1Y">warhammer</a> nerdpocalypse
            users group.
          </p>
          <p>
            Creative joy, community at its own pace. Speak when you have
            something to say. Check in when something moves you.
          </p>
          <h4>Let's be fun again</h4>
        </header>
      </section>
    </article>
    <div itemprop="support">
      <call-to-action />
    </div>
    <section itemprop="features">
      <ol>
        <li>
          <icon name="finished" />
          <p>
            <strong>Photo to poster</strong> Take a picture or paste from the
            clipboard. Layered vector art builds on your device.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Interactive exploration</strong> Every poster is fully live
            on the canvas. Toggle layers, drama, mosaic, and animation. Pan,
            zoom, touch the mosaic, or spin it in 3D to discover what it offers
            - then export what you find.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Export</strong> SVG, 4K PNG, or layered PSD. What you see on
            screen is what you download.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Keyboard shortcuts</strong> Toggle layers, drama, mosaic,
            animation, and fullscreen without leaving the canvas.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Mosaics</strong> Transparent windows through your poster,
            cut from contrast in your photo.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Shadows</strong> Gradient shadows and strokes for depth,
            outline, and dramatic light.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Gradients</strong> Eighteen color pulls from each image for
            fills across every layer.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>3D and presentation</strong> Spin a poster in 3D,
            side-scroll storytelling view, or go fullscreen.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Thought trains</strong> Statements and posters stack for
            thirteen minutes into one chronological train.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Events and phonebook</strong> See what is coming up and find
            people you know on Realness.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Offline and sync</strong> Install to your home screen or
            desktop. Works offline; sync when you sign in.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Not built for growth hacks</strong> <b class="no">Email</b>,
            <b class="no">Likes</b>, <b class="no">Links</b>, or
            <b class="no">SEO</b> - just posters and people you care about.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Checksumable build</strong>
            <a href="/build-manifest.json">build-manifest.json</a> lists a
            SHA-256 for every file we deploy. Match it to what realness.online
            serves and confirm the version we publish.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong
              ><a href="https://github.com/realness-online/web" rel="external"
                >Source available</a
              ></strong
            >
            Read the code, run it yourself, and send improvements upstream.
          </p>
        </li>
      </ol>
    </section>
    <hr />
    <section itemprop="integrations">
      <header>
        <h2>Integrations</h2>
      </header>
      <ol>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/illustrator.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>Illustrator</strong> Export SVG with editable layers and
            paths.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/figma.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p><strong>Figma</strong> Export SVG ready to import into Figma.</p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/photoshop.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>Photoshop</strong> Export layered PSD with shadows, strokes,
            and mosaic groups.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/after-effects.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>After Effects</strong> Export video or PSD layers for
            compositing.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/premiere-pro.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>Premiere Pro</strong> Export animated video to your
            timeline.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/blender.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p><strong>Blender</strong> Export GLB from the 3D view.</p>
        </li>
        <li>
          <span class="logo-wrap logo-wrap--light-bg"
            ><img
              class="integration-logo"
              src="/brands/unreal-engine.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>Unreal Engine</strong> Export GLB into your Unreal project.
          </p>
        </li>
        <li>
          <span class="logo-wrap logo-wrap--light-bg"
            ><img
              class="integration-logo"
              src="/brands/unity.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p><strong>Unity</strong> Export GLB into your Unity scene.</p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/davinci-resolve.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>DaVinci Resolve</strong> Export animated video into Resolve.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/final-cut-pro.png"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>Final Cut Pro</strong> Export animated video into Final Cut.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/affinity-designer.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p><strong>Affinity Designer</strong> Export SVG or layered PSD.</p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/affinity-photo.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>Affinity Photo</strong> Export layered PSD with full layer
            groups.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/inkscape.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>Inkscape</strong> Export SVG with editable vector paths.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/procreate.png"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p>
            <strong>Procreate</strong> Export layered PSD - open on iPad with
            every layer intact.
          </p>
        </li>
        <li>
          <span class="logo-wrap"
            ><img
              class="integration-logo"
              src="/brands/canva.svg"
              alt=""
              width="24"
              height="24"
              decoding="async"
          /></span>
          <p><strong>Canva</strong> Export SVG or PNG for layouts in Canva.</p>
        </li>
      </ol>
    </section>
    <section itemprop="gallery">
      <header>
        <h2>Gallery</h2>
        <menu class="gallery-preferences">
          <preference compact name="shadow" />
          <preference compact name="stroke" />
          <preference compact name="mosaic" />
          <preference compact name="drama" />
          <preference compact name="animate" />
          <preference compact name="view_3d" label="3D" />
        </menu>
      </header>
      <as-figure
        v-for="poster in gallery_posters"
        :key="poster.id"
        :itemid="poster.id" />
    </section>
    <footer itemprop="footer">
      <logo-as-link />
      <call-to-action />
    </footer>
  </section>
</template>

<style lang="stylus">
  @keyframes about-rise {
    from {
      opacity: 0;
      translate: 0 var(--base-line);
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  about-enter(delay = null)
    animation: about-rise var(--about-enter) var(--about-ease) both
    if delay
      animation-delay: delay

  about-section-heading()
    font-size: base-line * 3
    width: 100%
    max-width: base-line * 22
    text-align: center
    color: red
    margin: 0 auto base-line * 2

  about-feature-list()
    display: grid
    display: grid-lanes
    grid-gap: base-line
    grid-template-columns: repeat(auto-fill, minmax(325px, 1fr))

  section.page#about {
    max-width: 1800px;
    --about-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --about-enter: 820ms;
    --about-stagger: 56ms;
    --about-hero-delay: 500ms;
    --about-hero-stagger: 120ms;
    --about-follow-beat: 200ms;
    --about-hero-min-height: calc(var(--poster-grid-height) + var(--base-line) * 8);
    --about-article-copy-min-height: calc(var(--base-line) * 15);
    --about-article-list-min-height: calc(var(--base-line) * 20);
    --about-block-min-height: calc(var(--base-line) * 10);

    & > header {
      display: block;

      & > [itemprop='hero'] {
        min-height: var(--about-hero-min-height);

        @media (min-width: pad-begins) {
          display: flex;
          justify-content: space-around;
          align-items: stretch;
        }

        & > header {
          padding: base-line;
          min-height: calc(var(--base-line) * 12);

          @media (min-width: pad-begins) {
            margin-top: base-line * 2;
            width: base-line * 13;
          }

          & > h1 {
            color: blue;
            margin: 0;
            text-align: center;

            @media (min-width: pad-begins) {
              text-align: left;
            }
          }

          & > h3 {
            max-width: base-line * 10;
            text-align: right;
            margin: 0;
            color: red;

            @media (min-width: pad-begins) {
              max-width: inherit;
            }
          }

          & > h4 {
            text-align: center;
            line-height: 1.66;
          }

          & > p {
            margin-top: base-line;
            text-align: center;

            &[itemprop='workflow-tools'] {
              display: flex;
              flex-wrap: wrap;
              gap: 0.28em;
              align-items: baseline;
              justify-content: center;
              text-align: left;
            }
          }

          &:not(.about-ready) {
            & > h1,
            & > h3,
            & > p {
              opacity: 0;
            }
          }

          &.about-ready {
            & > h1 {
              about-enter(var(--about-hero-delay));
            }

            & > h3 {
              about-enter(calc(var(--about-hero-delay) + var(--about-hero-stagger)));
            }

            & > p {
              about-enter();

              &:nth-of-type(1) {
                animation-delay: calc(var(--about-hero-delay) + var(--about-hero-stagger) * 2);
              }

              &:nth-of-type(2) {
                animation-delay: calc(var(--about-hero-delay) + var(--about-hero-stagger) * 3);
              }
            }
          }

          @media (prefers-reduced-motion: reduce) {
            & > h1,
            & > h3,
            & > p {
              animation: none;
              opacity: 1;
            }
          }
        }

        & > figure.poster {
          min-height: var(--poster-grid-height);

          @media (min-width: pad-begins) {
            flex: 1;
            min-width: 0;
            align-self: stretch;
            height: auto;
            flex-direction: column;
          }

          &:has(svg[aria-orientation='horizontal']) {
            @media (min-width: pad-begins) {
              align-self: stretch;
            }
          }

          & > svg:not([data-poster-symbol-defs]) {
            height: 100%;
            transition: transform 2s;
            transform-style: preserve-3d;
            display: block;
            border-radius: base-line;
            width: 100%;
            flex: 1;
          }
        }
      }
    }

    & > article {
      margin: base-line * 2 0;
      padding: base-line;

      & > header {
        display: flex;
        justify-content: center;
        margin-bottom: base-line * 2;

        & > h2 {
          font-size: base-line * 3;
          width: 100%;
          max-width: base-line * 22;
          text-align: center;
          color: red;
          min-height: calc(var(--base-line) * 4);
        }
      }

      & > section {
        min-height: var(--poster-grid-height);

        @media (min-width: pad-begins) {
          min-height: max(var(--poster-grid-height), var(--about-article-copy-min-height));
          padding: base-line;
          display: flex;
          align-items: stretch;
        }

        & > figure.poster {
          min-height: var(--poster-grid-height);

          @media (min-width: pad-begins) {
            flex: 1;
            min-width: 0;
            align-self: stretch;
            min-height: 0;
            height: auto;
            display: flex;
            flex-direction: column;
          }

          &:has(svg[aria-orientation='horizontal']) {
            @media (min-width: pad-begins) {
              align-self: stretch;
            }
          }

          & > svg:not([data-poster-symbol-defs]) {
            border-radius: base-line * 0.33;
            width: 100%;
            flex: 1;
            min-height: 0;
          }
        }

        & > header,
        & > footer {
          display: flex;
          flex-direction: column;
          width: 100%;
          margin: 0 auto;
          min-height: var(--about-article-copy-min-height);

          @media (min-width: pad-begins) {
            padding: 0 base-line;
          }

          strong {
            color: blue;
          }

          & > h2 {
            margin-bottom: base-line * 3;
          }

          & > h4 {
            margin-top: base-line;
            margin-bottom: base-line * 2;
            text-align: center;
            line-height: 2;
            max-width: base-line * 13;
            align-self: center;
          }

          & > ol {
            list-style-type: square;

            & > li {
              margin-left: base-line;
            }
          }
        }

        & > header {
          max-width: base-line * 22;

          @media (min-width: pad-begins) {
            flex: 0 1 base-line * 22;
          }
        }

        & > footer {
          max-width: base-line * 21;

          @media (min-width: pad-begins) {
            flex: 0 1 base-line * 18;
          }
        }
      }

      &.revealed {
        & > header > h2 {
          about-enter();
        }

        & > section {
          & > header,
          & > footer {
            about-enter(var(--about-follow-beat));
          }
        }
      }
    }

    & > [itemprop='support'] {
      min-height: var(--about-block-min-height);

      &.revealed > * {
        about-enter();
      }
    }

    & > [itemprop='features'] {
      padding: base-line;
      min-height: var(--about-article-list-min-height);

      & > ol {
        about-feature-list();

        & > li {
          position: relative;
          display: block;

          & > svg.icon {
            position: absolute;
            fill: blue;
          }

          & > p {
            margin-left: base-line * 2;
            margin-bottom: 0;

            & > b.no {
              text-decoration: line-through;
            }
          }
        }
      }

      &.revealed > ol > li {
        about-enter();

        for i in 1..15 {
          &:nth-child({i}) {
            animation-delay: calc((i - 1) * var(--about-stagger));
          }
        }
      }
    }

    & > [itemprop='integrations'] {
      padding: base-line;
      min-height: var(--about-article-list-min-height);

      & > header > h2 {
        about-section-heading();
        margin-bottom: base-line * 3;
      }

      & > ol {
        about-feature-list();

        & > li {
          position: relative;
          display: block;

          & > p {
            margin-left: base-line * 2;
            margin-bottom: 0;
          }

          & > .logo-wrap {
            position: absolute;
            top: 0;
            left: 0;
            width: base-line * 1.33;
            height: base-line * 1.33;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: base-line * 0.66;
            background: none;
            overflow: hidden;

            &.logo-wrap--light-bg {
              background: white;
            }

            & > .integration-logo {
              width: base-line * 1.33;
              height: base-line * 1.33;
              object-fit: contain;
            }
          }
        }
      }

      &.revealed {
        & > header {
          about-enter();
        }

        & > ol > li {
          about-enter();

          for i in 1..15 {
            &:nth-child({i}) {
              animation-delay: calc((i - 1) * var(--about-stagger));
            }
          }
        }
      }
    }

    & > [itemprop='gallery'] {
      margin-top: base-line * 4;
      min-height: calc(var(--poster-grid-height) + var(--base-line) * 6);
      standard-grid: gentle;
      grid-auto-flow: dense;
      padding: base-line;

      & > header {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: base-line * 0.75;
        align-items: center;
        align-self: center;

        & > h2 {
          about-section-heading();
        }

        & > menu.gallery-preferences {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: base-line base-line * 1.5;
          margin: 0;
          padding: 0;
          width: 100%;
          border: none;
        }
      }

      & > figure.poster {
        grid-column: span 1;
        grid-row: span 1;
        min-height: var(--poster-grid-height);
        width: 100%;
        display: flex;
        flex-direction: column;

        &.new {
          grid-column: span 1;
          grid-row: span 1;
        }

        &:has(svg[style*='aspect-ratio']) {
          grid-column: span 2;
          grid-row: span 1;
          min-height: auto;
        }

        @media (min-width: pad-begins) {
          &:has(svg[aria-orientation='horizontal']) {
            grid-column: span 2;
            grid-row: span 1;
            min-height: auto;
          }

          &:has(svg[aria-orientation='horizontal']):has(+ figure.poster:has(svg[aria-orientation='horizontal'])) {
            grid-column: span 2;
          }

          &:has(svg[aria-orientation='horizontal']) + figure.poster:has(svg[aria-orientation='horizontal']) {
            grid-column: span 2;
          }
        }

        & > svg:not([data-poster-symbol-defs]) {
          flex: 1;
          min-height: 0;
          border-radius: base-line * 0.21;
          height: 100%;
          width: 100%;
        }
      }

      &.revealed > header {
        about-enter();
      }
    }

    & > footer[itemprop='footer'] {
      display: block;
      min-height: 100vh;
      padding: base-line;

      & > a.logo {
        display: inline-block;
      }

      &.revealed > * {
        about-enter();

        &:nth-child(2) {
          animation-delay: var(--about-hero-stagger);
        }
      }
    }

    &.about-motion {
      & > article:not(.revealed) {
        & > header > h2,
        & > section > header,
        & > section > footer {
          opacity: 0;
        }
      }

      & > [itemprop='features']:not(.revealed) > ol > li,
      & > [itemprop='integrations']:not(.revealed) > header,
      & > [itemprop='integrations']:not(.revealed) > ol > li,
      & > [itemprop='gallery']:not(.revealed) > header,
      & > [itemprop='support']:not(.revealed) > *,
      & > [itemprop='footer']:not(.revealed) > * {
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      &.about-motion {
        & > article:not(.revealed) {
          & > header > h2,
          & > section > header,
          & > section > footer {
            opacity: 1;
          }
        }

        & > [itemprop='features']:not(.revealed) > ol > li,
        & > [itemprop='integrations']:not(.revealed) > header,
        & > [itemprop='integrations']:not(.revealed) > ol > li,
        & > [itemprop='gallery']:not(.revealed) > header,
        & > [itemprop='support']:not(.revealed) > *,
        & > [itemprop='footer']:not(.revealed) > * {
          opacity: 1;
        }
      }

      & > article.revealed,
      & > [itemprop='support'].revealed > *,
      & > [itemprop='features'].revealed > ol > li,
      & > [itemprop='integrations'].revealed > header,
      & > [itemprop='integrations'].revealed > ol > li,
      & > [itemprop='gallery'].revealed > header,
      & > [itemprop='footer'].revealed > * {
        animation: none;
      }
    }
  }
</style>
