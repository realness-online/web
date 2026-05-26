<script setup>
  import AsFigure from '@/components/posters/as-figure'
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import CallToAction from '@/components/call-to-action'
  import LogoAsLink from '@/components/logo-as-link'
  import { as_author } from '@/utils/itemid'
  import { use_posters } from '@/use/poster'
  import {
    onMounted as mounted,
    onUnmounted as dismount,
    inject,
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

  const gallery_posters = computed(() =>
    admin_posters.value.slice(ABOUT_FEATURED_POSTER_COUNT)
  )

  const documentation = inject('documentation')

  const show_documentation = () => documentation?.value?.show()

  /** @type {import('vue').Ref<HTMLElement | null>} */
  const about_el = ref(null)
  const about_ready = ref(false)
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
    about_el.value?.classList.add('about-motion')
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
    :class="{ 'about-ready': about_ready }">
    <header>
      <nav>
        <logo-as-link />
        <a @click="show_documentation">Docs</a>
      </nav>
      <section itemprop="hero">
        <header>
          <h1>Realness</h1>
          <h3>online</h3>
          <h4>Creativity Lives With You</h4>

          <p itemprop="workflow-tools">
            <span>
              With Realness, you can create expressive vector graphics from your
              drawings, designs, and photos. It works on your device and
              integrates with
            </span>
            <span itemprop="tool-rotator" aria-label="creative workflow tools">
              <span>Illustrator</span>
              <span>Figma</span>
              <span>Photoshop</span>
              <span>After Effects</span>
              <span>Premiere Pro</span>
              <span>Blender</span>
              <span>Unreal Engine</span>
              <span>Unity</span>
              <span>DaVinci Resolve</span>
              <span>Final Cut Pro</span>
              <span>Affinity Designer</span>
              <span>Affinity Photo</span>
              <span>Inkscape</span>
              <span>Procreate</span>
              <span>Canva</span>
            </span>
          </p>
          <p>
            Your data lives with you.
            <a href="#make-a-video">Install</a> Realness on your home screen
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
          <h2>We organize <strong>Posters</strong> into thoughts</h2>
          <p>
            Take a picture from your phone, and Realness creates a vector
            graphic we call a <strong>Poster</strong>. Posters are organized
            into Shadow and Mosaic layers that are easy to understand and export
            elegantly to your tools. A perfect interface between physical and
            digital drawing
          </p>
          <p>
            The data is made on the device. You can use all of Realness and only
            need to sign in to sync devices
          </p>
          <p>
            Your Poster is a natural fit for the web. Posters are optimized to
            be expressive, small, and to run fast. You can extract a color
            palette, animate a filter or gradient. The individual parts of a
            Poster are easy to query and feel natural to access and manipulate
          </p>
          <h4>
            Animators, Designers, Hand-coders —
            <strong>Realness</strong> was built for you.
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
            You can create your own social network with Realness. Use it with
            your design team as a fun way to play and be creative. While easy to
            administer, Realness encourages internet literacy. The time and
            investment you put into a realness of your own helps you understand
            the power of the internet.
          </p>
          <p>
            Use it with just your family, union hall, or maybe your
            <a href="https://youtu.be/05YRMHWtv1Y">warhammer</a>
            nerdpocalypse users group. Realness sets you up with all the
            benefits of a serverless web application to advantage intimate
            useful communities with clear lines of responsibility and
            communication. There is joy in our care for the maintenance and
            content on the web.
          </p>
          <p>
            The performance is over. Our social health requires more realness
            online.
          </p>
          <h4>Let's be fun again</h4>
        </header>
      </section>
    </article>
    <article itemprop="developers">
      <header><h2>Developers</h2></header>
      <section>
        <as-figure v-if="admin_posters.length" :itemid="admin_posters[3]?.id" />

        <header>
          <h2>HTML is Our Database</h2>
          <p>
            Realness is a way and a support system to help you build web
            applications.
          </p>
          <p>
            It's natural to build web applications with HTML, especially for
            <i>edge-first</i> apps. Orienting to this has helped Realness take
            advantage of what's possible on the web today. How you build your
            app can create opportunities over the monetized client-server model
            we are used to today.
          </p>
          <p>
            Edge-first is native, fast, more secure, and gives you choices
            around data storage that don't exist with traditional stacks. With
            an edge-first approach, you can make a quick and seamless transition
            from a user experience demo to product development.
          </p>
          <p>
            Edge on the web opens the DOM up as a typing system and object
            model. There are natural constraints on HTML that support accessible
            applications.
          </p>
          <p>
            Developers can use Realness to free themselves from SQL and the
            tyranny of a full-stack mindset. Development roles can be less
            hierarchical. Products can be fun to build, naturally more in line
            with our customers' expectations.
          </p>
          <p>
            Build applications faster with less overhead that keeps stakeholders
            involved. All of it uses only HTML, CSS, and JavaScript.
          </p>
          <p>
            Can a single developer provide a service all can use? Scott Fryxell
            is the developer behind Realness, and that's what I'm trying to find
            out.
          </p>
          <p>
            Sign in to Realness, and you can message me directly. Visit the code
            <a href="https://github.com/realness-online/web" rel="external"
              >online</a
            >. I keep a
            <a href="https://scott-fryxell.github.io/" rel="external">blog</a>
            about all my feelings and nerd problems. My resume is on there.
          </p>
          <h4>Cyber the App Store</h4>
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
          <p>Sign in to sync your device</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Create your own social network</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Ready for your workflow</p>
        </li>

        <li>
          <icon name="finished" />
          <p>Posters organized into a Timeline of your thoughts</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Mosaics, shadows, masks, patterns, gradients</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Sign in with your phone number</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Works on any device</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Direct support from the development team</p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            <b class="no">Email</b>, <b class="no">Likes</b>,
            <b class="no">Links</b>,
            <b class="no">SEO</b>
          </p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>
            <a href="https://github.com/realness-online/web" rel="external">
              Source Available
            </a>
            with semantic HTML and microdata
          </p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>Sensitive data stays on the device</p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>Your projects live under ${name}.web.app</p>
        </li>
      </ol>
    </section>
    <section itemprop="gallery">
      <header>
        <h2>Gallery</h2>
        <preference name="shadow" />
        <preference name="mosaic" />
        <preference name="drama" />
        <preference name="animate" />
        <preference name="view_3d" label="3D" />
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

  @keyframes workflow-tool-cycle {
    0%, 4.8% {
      opacity: 1;
      translate: 0 0;
    }
    6.6%, 100% {
      opacity: 0;
      translate: 0 -0.65em;
    }
  }

  section.page#about {
    max-width:1800px;
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

    .no {
      text-decoration: line-through;
    }
    svg.icon {
      fill: blue;
    }
    [itemprop='workflow-tools'] {
      display: flex;
      flex-wrap: wrap;
      gap: 0.28em;
      align-items: baseline;
      justify-content: center;
      text-align: left;
    }
    [itemprop='tool-rotator'] {
      display: inline-grid;
      min-width: 8.2em;
      color: blue;
      font-weight: bold;
      span {
        grid-area: 1 / 1;
        opacity: 0;
        animation: workflow-tool-cycle 30s ease-in-out infinite;
        for i in 1..15 {
          &:nth-child({i}) {
            animation-delay: (i - 1) * 2s;
          }
        }
      }
    }
    & > header {
      display: block;
      & > nav {
        display: flex;
        justify-content: space-between;
        margin-bottom: base-line * 2;
        svg.icon {
          fill: blue;
        }
        & > a:not(.logo) {
          cursor: pointer;
          &:hover,
          &:focus-visible {
            opacity: 0.55;
          }
        }
      }
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
            @media (min-width: pad-begins) {
              max-width: inherit;
            }
            text-align: right;
            margin: 0;
            color: red;
          }
          & > h4 {
            text-align: center
            line-height:1.66
          }
          & > p {
            margin-top: base-line;
            text-align: center;
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
          & > svg {
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
    &:not(.about-ready) > header > [itemprop='hero'] > header {
      & > h1,
      & > h3,
      & > p {
        opacity: 0;
      }
    }
    &.about-ready > header > [itemprop='hero'] > header {
      & > h1 {
        animation: about-rise var(--about-enter) var(--about-ease) both;
        animation-delay: var(--about-hero-delay);
      }
      & > h3 {
        animation: about-rise var(--about-enter) var(--about-ease) both;
        animation-delay: calc(var(--about-hero-delay) + var(--about-hero-stagger));
      }
      & > p {
        animation: about-rise var(--about-enter) var(--about-ease) both;
        &:nth-of-type(1) {
          animation-delay: calc(var(--about-hero-delay) + var(--about-hero-stagger) * 2);
        }
        &:nth-of-type(2) {
          animation-delay: calc(var(--about-hero-delay) + var(--about-hero-stagger) * 3);
        }
        &:nth-of-type(3) {
          animation-delay: calc(var(--about-hero-delay) + var(--about-hero-stagger) * 4);
        }
      }
    }
    &.about-motion > article:not(.revealed) {
      & > header > h2,
      & > section > header,
      & > section > footer {
        opacity: 0;
      }
    }
    &.about-motion > [itemprop='features']:not(.revealed) > ol > li {
      opacity: 0;
    }
    &.about-motion > [itemprop='gallery']:not(.revealed) > header {
      opacity: 0;
    }
    &.about-motion > [itemprop='support']:not(.revealed) > *,
    &.about-motion > [itemprop='footer']:not(.revealed) > * {
      opacity: 0;
    }
    & > article.revealed {
      & > header > h2 {
        animation: about-rise var(--about-enter) var(--about-ease) both;
      }
      & > section > header,
      & > section > footer {
        animation: about-rise var(--about-enter) var(--about-ease) both;
        animation-delay: var(--about-follow-beat);
      }
    }
    & > [itemprop='support'].revealed > * {
      animation: about-rise var(--about-enter) var(--about-ease) both;
    }
    & > [itemprop='features'].revealed > ol > li {
      animation: about-rise var(--about-enter) var(--about-ease) both;
      for i in 1..15 {
        &:nth-child({i}) {
          animation-delay: calc((i - 1) * var(--about-stagger));
        }
      }
    }
    & > [itemprop='gallery'].revealed > header {
      animation: about-rise var(--about-enter) var(--about-ease) both;
    }
    & > [itemprop='footer'].revealed > * {
      animation: about-rise var(--about-enter) var(--about-ease) both;
      &:nth-child(2) {
        animation-delay: var(--about-hero-stagger);
      }
    }
    & > article {
      & > header > h2 {
        min-height: calc(var(--base-line) * 4);
      }
      & > section {
        min-height: var(--poster-grid-height);
        @media (min-width: pad-begins) {
          min-height: max(var(--poster-grid-height), var(--about-article-copy-min-height));
        }
      }
      & > section > figure.poster {
        min-height: var(--poster-grid-height);
      }
      & > section > header,
      & > section > footer {
        min-height: var(--about-article-copy-min-height);
      }
    }
    & > [itemprop='support'] {
      min-height: var(--about-block-min-height);
    }
    & > [itemprop='features'] {
      min-height: var(--about-article-list-min-height);
      padding: base-line;
      & > ol {
        display: grid;
        display: grid-lanes;
        grid-gap: base-line;
        grid-template-columns: repeat(auto-fill, minmax(325px, 1fr));
        li {
          position: relative;
          display: block;
          svg {
            position: absolute;
          }
          p {
            margin-left: base-line * 2;
            margin-bottom: 0;
          }
        }
      }
    }
    & > [itemprop='gallery'] {
      min-height: calc(var(--poster-grid-height) + var(--base-line) * 6);
      standard-grid: gentle;
      grid-auto-flow: dense;
      padding: base-line;
      & > header {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(325px, 1fr));
        grid-gap: base-line;
        align-items: start;
        & > h2 {
          grid-column: 1 / -1;
          margin: 0 0 base-line 0;
          text-align: center;
          color: red;
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
        & > svg {
          flex: 1;
          min-height: 0;
          border-radius: base-line * 0.21;
          height: 100%;
          width: 100%;
        }
      }
    }
    & > menu {
      border-radius: base-line;
      display: flex;
      justify-content: space-between;
      padding: base-line;
      @media (min-width: pad-begins) {
        margin: base-line;
        justify-content: center;
      }
      & > button {
        border-radius: base-line * 0.33;
        color: blue;
        background-color: white;
        font-weight: bold;
        max-width: 10rem;
        line-height: 1.33;
        @media (prefers-color-scheme: dark) {
          background-color: black;
        }
        @media (min-width: pad-begins) {
          margin: 0 base-line;
        }
        &[aria-selected=false] {
          border-color: transparent;
          background-color: transparent;
          font-size: smaller;
          text-shadow: 1px 1px transparent;
          @media (min-width: pad-begins) {
            font-size: larger;
          }
        }
        &[aria-selected=true] {
          font-size: smaller;
          color: #ffffff;
          text-shadow: 1px 1px blue;
          @media (min-width: pad-begins) {
            font-size: larger;
          }
          @media (prefers-color-scheme: dark) {
            color: white;
          }
        }
      }
    }
    & > article {
      margin: base-line 0;
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
        }
      }
      & > section {
        @media (min-width: pad-begins) {
          padding: base-line;
          display: flex;
          align-items: stretch;
        }
        & > figure.poster {
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
          & > svg {
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

    }
    & > footer {
      display: block;
      min-height: 100vh;
      padding: base-line;
      & > a.logo {
        display: inline-block;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      &.about-ready > header > [itemprop='hero'] > header {
        & > h1,
        & > h3,
        & > p {
          animation: none;
          opacity: 1;
        }
      }
      &:not(.about-ready) > header > [itemprop='hero'] > header {
        & > h1,
        & > h3,
        & > p {
          opacity: 1;
        }
      }
      &.about-motion > article:not(.revealed) {
        & > header > h2,
        & > section > header,
        & > section > footer {
          opacity: 1;
        }
      }
      &.about-motion > [itemprop='features']:not(.revealed) > ol > li,
      &.about-motion > [itemprop='gallery']:not(.revealed) > header,
      &.about-motion > [itemprop='support']:not(.revealed) > *,
      &.about-motion > [itemprop='footer']:not(.revealed) > * {
        opacity: 1;
      }
      & > article.revealed,
      & > article.revealed > header,
      & > article.revealed > section > header,
      & > article.revealed > section > footer,
      & > [itemprop='support'].revealed,
      & > [itemprop='features'].revealed > ol > li,
      & > [itemprop='gallery'].revealed > header,
      & > [itemprop='footer'].revealed > * {
        animation: none;
      }
      [itemprop='tool-rotator'] span {
        animation: none;
        &:not(:first-child) {
          display: none;
        }
        &:first-child {
          opacity: 1;
        }
      }
    }
  }
</style>
