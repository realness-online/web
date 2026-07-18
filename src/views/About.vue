<script setup>
  import AsFigure from '@/components/posters/as-figure'
  import icon from '@/components/icon'
  import Preference from '@/components/preference'
  import PreferencesMenu from '@/components/preferences-menu'
  import CallToAction from '@/components/call-to-action'
  import InstallGuide from '@/components/install-guide.vue'
  import LogoAsLink from '@/components/logo-as-link'
  import { install_method } from '@/utils/platform'
  import { as_author } from '@/utils/itemid'
  import { balance_gallery_posters } from '@/utils/balance-gallery-posters'
  import { reset_preferences } from '@/utils/preference'
  import { use_posters } from '@/use/poster'
  import {
    onMounted as mounted,
    onUnmounted as unmounted,
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
  const ABOUT_GALLERY_MAX_COUNT = 13

  /** @type {import('vue').Ref<import('@/types').Item[]>} */
  const gallery_posters = ref([])

  const install_noun = install_method().noun
  /** @type {import('vue').Ref<HTMLDialogElement | null>} */
  const install_dialog = ref(null)
  const on_show_install = () => install_dialog.value?.showModal()
  /** @param {MouseEvent} event */
  const on_close_on_backdrop = event => {
    if (event.target === install_dialog.value) install_dialog.value?.close()
  }

  const balance_gallery = async () => {
    const featured = admin_posters.value.slice(0, ABOUT_FEATURED_POSTER_COUNT)
    const sliced = admin_posters.value.slice(ABOUT_FEATURED_POSTER_COUNT)
    gallery_posters.value = await balance_gallery_posters(sliced, {
      featured,
      max: ABOUT_GALLERY_MAX_COUNT
    })
  }

  /** @type {import('vue').Ref<HTMLElement | null>} */
  const about_el = ref(null)
  const about_ready = ref(false)
  const about_motion = ref(false)
  /** @type {IntersectionObserver | null} */
  let section_observer = null

  const SECTION_REVEAL_RATIO = 0.33
  const SECTION_REVEAL_INSET = 0.1
  const PERCENT = 100
  const reveal_sections = () =>
    Array.from(about_el.value?.children ?? []).filter(
      el =>
        el.hasAttribute('itemprop') && el.getAttribute('itemprop') !== 'footer'
    )

  /** @param {Element} section */
  const reveal_trigger = section => {
    if (section.localName === 'article')
      return section.querySelector(':scope > section') ?? section
    if (section.getAttribute('itemprop') === 'gallery')
      return section.querySelector(':scope > header') ?? section
    if (section.getAttribute('itemprop') === 'preferences')
      return section.querySelector(':scope > header') ?? section
    if (section.getAttribute('itemprop') === 'features')
      return section.querySelector(':scope > ol > li:first-child') ?? section
    if (section.getAttribute('itemprop') === 'support')
      return section.querySelector(':scope > [data-call-to-action]') ?? section
    return section
  }

  /** @param {Element} section */
  const reveal_section = section => {
    if (section.hasAttribute('data-revealed')) return
    section.setAttribute('data-revealed', '')
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
      if (section.hasAttribute('data-revealed')) return
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
      if (!section.hasAttribute('data-revealed'))
        section_observer?.observe(trigger)
    })
  }

  const observe_sections = () => {
    about_motion.value = true
    // Pre-hide must paint before `[data-revealed]` or enter animations are skipped.
    requestAnimationFrame(() => {
      requestAnimationFrame(connect_section_observer)
    })
  }

  mounted(async () => {
    await posters_for_admin({ id: import.meta.env.VITE_ADMIN_ID })
    await balance_gallery()
    about_ready.value = true
    await tick()
    observe_sections()
  })

  unmounted(() => {
    section_observer?.disconnect()
  })
</script>

<template>
  <section
    id="about"
    ref="about_el"
    data-page
    itemscope
    itemtype="/about"
    :data-about-motion="about_motion || undefined">
    <header>
      <section itemprop="hero">
        <header :data-about-ready="about_ready || undefined">
          <h1>Realness</h1>
          <h3>online</h3>
          <h4>Creativity Lives With You</h4>
          <p itemprop="workflow-tools">
            Realness is a rotoscoping tool. Trace photos into expressive vector
            graphics on your device, integrated with the tools you already use.
          </p>
          <p>
            Start in your browser, or
            <a href="/docs#install" @click.prevent="on_show_install"
              >add Realness to your {{ install_noun }}</a
            >
            - works like a native app, straight from the web. Your data lives
            with you.
          </p>
        </header>
        <as-figure v-if="admin_posters.length" :itemid="admin_posters[0]?.id" />
      </section>
    </header>
    <dialog
      ref="install_dialog"
      id="install"
      data-modal
      @click="on_close_on_backdrop">
      <article>
        <button
          type="button"
          autofocus
          aria-label="Close"
          @click="install_dialog?.close()">
          <icon name="remove" />
        </button>
        <install-guide />
      </article>
    </dialog>
    <article itemprop="artists">
      <header><h2>Artists</h2></header>
      <section>
        <as-figure v-if="admin_posters.length" :itemid="admin_posters[1]?.id" />
        <footer>
          <h2>Magic in your hands</h2>
          <p>
            Though a poster is ornate, capable, and descriptive, there is no
            line work. Posters can be taken so much further in your tool of
            choice. Print layers on transparency film and stack them like
            Disney-era cel animation—register the stack on a light table. Export
            and print in an infinite loop of creative discovery. The constraints
            become a vast landscape for you to explore.
          </p>
          <p>
            Storyboards, collage, thumbnails. No AI in the toolchain. Realness
            is a clean slate for you to start.
          </p>
          <p>Everything is made locally. Sign in to sync devices.</p>
          <h4>
            Animators, designers, developers - <strong>Realness</strong> was
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
            Run your own Realness. Hosting your own stays simple - so you can
            free your data and build community together. One moderator, clear
            responsibility, built for trust—until you sign in, that's the feed.
            Use it with your family, union hall, or your
            <a href="https://youtu.be/05YRMHWtv1Y">Warhammer</a> nerdpocalypse
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
            <strong>Mosaics</strong> Photo-colored tiles layered over shadow.
            Five sizes from sediment to boulders - peel them back one at a time.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Shadows</strong> Gradient values and strokes for depth,
            outline, subtle movement and dramatic light.
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
            <strong>Interactive exploration</strong> Turn layers off one at a
            time. Hover or hold to isolate a layer. Reframe and pan until you
            see how the poster was built.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Export</strong> SVG, 4K PNG, layered PNG, PSD, video, or
            GLB. What you see on screen is what you download.
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
            <strong>3D and presentation</strong> Spin a poster in 3D,
            side-scroll storytelling view, or go fullscreen.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Trains of thought</strong> Every new statement you add for
            13 minutes is added to the last, giving you time to think and
            explore
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Unshortened</strong> Tap the silhouette in Thoughts to see
            only your posters and statements.
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
            <strong>Talk off-app</strong> Your number lets friends and
            moderators reach you where you already talk. Realness is for showing
            up; conversation continues in your messenger.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Focused</strong> <del>Email</del>, <del>Likes</del>,
            <del>Links</del>, or <del>Scraping</del> - just posters and people
            you care about.
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <strong>Verifiable</strong>
            Don't trust the live site on its own say-so.
            <code>npm run verify</code> rehashes what we serve against the
            checksums on the
            <a
              href="https://github.com/realness-online/web/releases"
              rel="external"
              >GitHub release</a
            >
            - same build, independent root of trust.
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
    <section itemprop="gallery">
      <header>
        <h2>Gallery</h2>
        <menu>
          <preference compact name="shadow" />
          <preference compact name="stroke" />
          <preference compact name="mosaic" />
          <preference compact name="drama" />
          <preference compact icon name="animate" />
          <preference compact icon name="view_3d" label="3D" />
        </menu>
      </header>
      <as-figure
        v-for="poster in gallery_posters"
        :key="poster.id"
        :itemid="poster.id" />
    </section>
    <hr />
    <section itemprop="preferences">
      <header>
        <h2>Preferences</h2>
        <p>
          Layers, geology, motion, 3D atmosphere - every poster responds to what
          you turn on. Scroll the gallery above with these toggles, or reset
          everything and start clean.
        </p>
        <button type="button" @click="reset_preferences">Reset</button>
      </header>
      <preferences-menu icon />
    </section>

    <section itemprop="integrations">
      <header>
        <h2>Integrations</h2>
      </header>
      <ol>
        <li>
          <span
            ><img
              src="/brands/illustrator.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>Illustrator</strong> Export SVG with editable layers and
            paths.
          </p>
        </li>
        <li>
          <span
            ><img
              src="/brands/figma.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p><strong>Figma</strong> Export SVG ready to import into Figma.</p>
        </li>
        <li>
          <span
            ><img
              src="/brands/photoshop.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>Photoshop</strong> Export layered PSD with shadows, strokes,
            and mosaic groups.
          </p>
        </li>
        <li>
          <span
            ><img
              src="/brands/after-effects.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>After Effects</strong> Export video or PSD layers for
            compositing.
          </p>
        </li>
        <li>
          <span
            ><img
              src="/brands/premiere-pro.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>Premiere Pro</strong> Export animated video to your
            timeline.
          </p>
        </li>
        <li>
          <span
            ><img
              src="/brands/blender.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p><strong>Blender</strong> Export GLB from the 3D view.</p>
        </li>
        <li>
          <span data-light-bg
            ><img
              src="/brands/unreal-engine.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>Unreal Engine</strong> Export GLB into your Unreal project.
          </p>
        </li>
        <li>
          <span data-light-bg
            ><img
              src="/brands/unity.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p><strong>Unity</strong> Export GLB into your Unity scene.</p>
        </li>
        <li>
          <span
            ><img
              src="/brands/davinci-resolve.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>DaVinci Resolve</strong> Export animated video into Resolve.
          </p>
        </li>
        <li>
          <span
            ><img
              src="/brands/final-cut-pro.png"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>Final Cut Pro</strong> Export animated video into Final Cut.
          </p>
        </li>
        <li>
          <span
            ><img
              src="/brands/affinity.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>Affinity</strong> Export SVG or layered PSD with full layer
            groups.
          </p>
        </li>
        <li>
          <span
            ><img
              src="/brands/inkscape.svg"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>Inkscape</strong> Export SVG with editable vector paths.
          </p>
        </li>
        <li>
          <span
            ><img
              src="/brands/procreate.png"
              alt=""
              width="40"
              height="40"
              decoding="async"
          /></span>
          <p>
            <strong>Procreate</strong> Export layered PSD - open on iPad with
            every layer intact.
          </p>
        </li>
      </ol>
    </section>
    <hr />
    <footer itemprop="footer">
      <logo-as-link />
      <call-to-action id="medium-is-the-message" />
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

  about-enter(delay = null) {
    animation: about-rise var(--about-enter) var(--about-ease) both;
    if delay {
      animation-delay: delay;
    }
  }

  about-section-heading() {
    font-size: base-line * 3;
    width: 100%;
    max-width: base-line * 22;
    text-align: center;
    color: var(--emphasis);
    margin: 0 auto base-line * 2;
  }

  about-feature-list() {
    display: grid;
    display: grid-lanes;
    grid-gap: base-line;
    grid-template-columns: repeat(auto-fill, minmax(325px, 1fr));
  }

  section#about[data-page] {
    --about-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --about-enter: 820ms;
    --about-stagger: 56ms;
    --about-hero-delay: 120ms;
    --about-hero-stagger: 70ms;
    --about-follow-beat: 200ms;
    --about-hero-min-height: calc(var(--poster-grid-height) + var(--base-line) * 8);
    --about-article-copy-min-height: calc(var(--base-line) * 15);
    --about-article-list-min-height: calc(var(--base-line) * 20);
    --about-block-min-height: calc(var(--base-line) * 10);
    margin-bottom: 0;
    max-width: 1800px;

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
            flex: 0 1 base-line * 20;
            max-width: base-line * 20;
          }

          & > h1 {
            color: var(--accent);
            margin: 0;
            text-align: center;

            @media (min-width: pad-begins) {
              text-align: left;
              width: base-line * 13;
            }
          }

          & > h3 {
            max-width: base-line * 10;
            text-align: right;
            margin: 0;
            color: var(--emphasis);

            @media (min-width: pad-begins) {
              width: base-line * 13;
              max-width: base-line * 13;
            }
          }

          & > h4 {
            margin: 0;
            text-align: center;
            line-height: 1.66;

            @media (min-width: pad-begins) {
              text-align: left;
            }
          }

          & > p {
            margin-top: base-line;
            text-align: center;

            @media (min-width: pad-begins) {
              text-align: left;
            }

            &[itemprop='workflow-tools'] {
              max-width: base-line * 20;
            }
          }

          &:not([data-about-ready]) {
            & > h1,
            & > h3,
            & > h4,
            & > p {
              opacity: 0;
            }
          }

          &[data-about-ready] {
            & > h1 {
              about-enter(var(--about-hero-delay));
            }

            & > h3 {
              about-enter(calc(var(--about-hero-delay) + var(--about-hero-stagger)));
            }

            & > h4 {
              about-enter(calc(var(--about-hero-delay) + var(--about-hero-stagger) * 2));
            }

            & > p {
              about-enter();

              &:nth-of-type(1) {
                animation-delay: calc(var(--about-hero-delay) + var(--about-hero-stagger) * 3);
              }

              &:nth-of-type(2) {
                animation-delay: calc(var(--about-hero-delay) + var(--about-hero-stagger) * 4);
              }
            }
          }

          @media (prefers-reduced-motion: reduce) {
            & > h1,
            & > h3,
            & > h4,
            & > p {
              animation: none;
              opacity: 1;
            }
          }
        }

        & > figure:has([itemtype='/posters']) {
          min-height: var(--poster-grid-height);
          about-enter(var(--about-hero-delay));

          @media (prefers-reduced-motion: reduce) {
            animation: none;
            opacity: 1;
          }

          @media (min-width: pad-begins) {
            flex: 1;
            min-width: 0;
            align-self: stretch;
            height: auto;
            flex-direction: column;
          }

          &:has(svg[data-orientation='horizontal']) {
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
          color: var(--emphasis);
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

        & > figure:has([itemtype='/posters']) {
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

          &:has(svg[data-orientation='horizontal']) {
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
          justify-content: center;
          width: 100%;
          margin-inline: auto;

          @media (min-width: pad-begins) {
            min-height: var(--about-article-copy-min-height);
            padding: 0 base-line;
          }

          strong {
            color: var(--accent);
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

      &[data-revealed] {
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

    & > [itemprop='communities'] {
      & > section {
        min-height: calc(var(--poster-grid-height) + var(--base-line) * 4);

        @media (min-width: pad-begins) {
          min-height: max(calc(var(--poster-grid-height) + var(--base-line) * 6), var(--about-article-copy-min-height));
        }

        & > figure:has([itemtype='/posters']) {
          min-height: calc(var(--poster-grid-height) + var(--base-line) * 2);

          @media (min-width: pad-begins) {
            flex: 1.5;
          }
        }

        & > header {
          max-width: base-line * 20;

          @media (min-width: pad-begins) {
            flex: 0 1 base-line * 20;
          }
        }
      }
    }

    & > [itemprop='support'] {
      @media (min-width: pad-begins) {
        min-height: var(--about-block-min-height);
      }

      &[data-revealed] > * {
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
           fill: var(--accent);
          }

          & > p {
            margin-left: base-line * 2;
            margin-bottom: 0;
          }
        }
      }

      &[data-revealed] > ol > li {
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
      @media (min-width: pad-begins) {
        padding: base-line * 2;
        min-height: 100vh;
      }

      & > header > h2 {
        about-section-heading();
        margin-bottom: base-line * 2;
        @media (min-width: pad-begins) {
          margin-bottom: base-line * 4;
        }
      }

      & > ol {
        about-feature-list();
        grid-gap: base-line * 1.5;
        grid-template-columns: minmax(0, 1fr);
        @media (min-width: pad-begins) {
          grid-gap: base-line * 2;
          grid-template-columns: repeat(auto-fill, minmax(375px, 1fr));
        }

        & > li {
          position: relative;
          display: block;
          padding-left: base-line * 0.25;

          & > p {
            margin-left: base-line * 3;
            margin-bottom: 0;
          }

          & > span {
            position: absolute;
            top: 0;
            left: 0;
            width: base-line * 2;
            height: base-line * 2;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: base-line * 0.66;
            background: none;
            overflow: hidden;

            &[data-light-bg] {
              background: var(--contrast);
            }

            & > img {
              width: base-line * 2;
              height: base-line * 2;
              object-fit: contain;
            }
          }
        }
      }

      &[data-revealed] {
        & > header {
          about-enter();
        }

        & > ol > li {
          about-enter();

          for i in 1..7 {
            &:nth-child({i}) {
              animation-delay: calc((i - 1) * var(--about-stagger));
            }
          }
        }
      }
    }

    & > [itemprop='preferences'] {
      padding: base-line;
      min-height: 100vh;

      & > header {
        margin-bottom: base-line * 3;

        & > h2 {
          about-section-heading();
        }

        & > p {
          max-width: base-line * 28;
          margin: 0 auto base-line * 2;
          text-align: center;
          line-height: 1.66;
        }

        & > button {
          display: block;
          margin: 0 auto;
          padding: base-line * 0.5 base-line * 2;
          border: 1px solid var(--emphasis);
          border-radius: base-line * 0.33;
          background: none;
          color: var(--emphasis);
          cursor: pointer;
          font: inherit;

          &:hover,
          &:focus-visible {
            background: var(--emphasis);
            color: white;
          }
        }
      }

      &[data-revealed] {
        & > header {
          about-enter();
        }

        menu[data-preferences-menu] > article {
          about-enter();

          for i in 1..3 {
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

        & > menu {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: base-line base-line * 1.5;
          width: 100%;
          border: none;
        }
      }

      & > figure:has([itemtype='/posters']) {
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
          &:has(svg[data-orientation='horizontal']) {
            grid-column: span 2;
            grid-row: span 1;
            min-height: auto;
          }

          &:has(svg[data-orientation='horizontal']):has(+ figure:has([itemtype='/posters']):has(svg[data-orientation='horizontal'])) {
            grid-column: span 2;
          }

          &:has(svg[data-orientation='horizontal']) + figure:has([itemtype='/posters']):has(svg[data-orientation='horizontal']) {
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

      &[data-revealed] > header {
        about-enter();
      }
    }

    & > footer[itemprop='footer'] {
      display: block;
      padding: base-line;
      @media (min-width: pad-begins) {
        min-height: 100vh;
      }

      & > * {
        opacity: 1;
        animation: none;
      }

      & > a[aria-label='Realness home'] {
        display: inline-block;
      }
    }

    &[data-about-motion] {
      & > article:not([data-revealed]) {
        & > header > h2,
        & > section > header,
        & > section > footer {
          opacity: 0;
        }
      }

      & > [itemprop='features']:not([data-revealed]) > ol > li,
      & > [itemprop='integrations']:not([data-revealed]) > header,
      & > [itemprop='integrations']:not([data-revealed]) > ol > li,
      & > [itemprop='preferences']:not([data-revealed]) > header,
      & > [itemprop='preferences']:not([data-revealed]) menu[data-preferences-menu] > article,
      & > [itemprop='gallery']:not([data-revealed]) > header,
      & > [itemprop='support']:not([data-revealed]) > * {
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      &[data-about-motion] {
        & > article:not([data-revealed]) {
          & > header > h2,
          & > section > header,
          & > section > footer {
            opacity: 1;
          }
        }

        & > [itemprop='features']:not([data-revealed]) > ol > li,
        & > [itemprop='integrations']:not([data-revealed]) > header,
        & > [itemprop='integrations']:not([data-revealed]) > ol > li,
        & > [itemprop='preferences']:not([data-revealed]) > header,
        & > [itemprop='preferences']:not([data-revealed]) > menu > article,
        & > [itemprop='gallery']:not([data-revealed]) > header,
        & > [itemprop='support']:not([data-revealed]) > * {
          opacity: 1;
        }
      }

      & > article[data-revealed],
      & > [itemprop='support'][data-revealed] > *,
      & > [itemprop='features'][data-revealed] > ol > li,
      & > [itemprop='integrations'][data-revealed] > header,
      & > [itemprop='integrations'][data-revealed] > ol > li,
      & > [itemprop='preferences'][data-revealed] > header,
      & > [itemprop='preferences'][data-revealed] menu[data-preferences-menu] > article,
      & > [itemprop='gallery'][data-revealed] > header {
        animation: none;
      }
    }
  }
</style>
