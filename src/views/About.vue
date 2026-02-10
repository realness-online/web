<script setup>
  import { onMounted as mounted, inject } from 'vue'
  import AsFigure from '@/components/posters/as-figure'
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import CallToAction from '@/components/call-to-action'
  import LogoAsLink from '@/components/logo-as-link'
  import { use_posters } from '@/use/poster'
  sessionStorage.about = true
  const version = import.meta.env.PACKAGE_VERSION
  const { posters, for_person: posters_for_admin } = use_posters()

  const documentation = inject('documentation')

  const show_documentation = () => documentation?.value?.show()

  mounted(async () => {
    await posters_for_admin({ id: import.meta.env.VITE_ADMIN_ID })
  })
</script>

<template>
  <section id="about" class="page">
    <header>
      <nav>
        <logo-as-link />
        <a @click="show_documentation"
          >Documentation <span>{{ version }}</span></a
        >
      </nav>
      <section class="hero">
        <header>
          <h1>Realness</h1>
          <h3>online</h3>
          <p>Install Realness on your home screen</p>
          <p>
            Realness creates expressive vector graphics from your designs and
            photos. It works on any device.
          </p>
          <p>
            Once you save your creations, they will integrate into any workflow
            that uses SVG.
          </p>
        </header>
        <as-figure v-if="posters.length" :itemid="posters[0]?.id" />
      </section>
    </header>
    <article class="designers">
      <header><h2>Artists</h2></header>
      <section>
        <as-figure v-if="posters.length" :itemid="posters[1]?.id" />
        <header>
          <h2>We call them <strong>Posters</strong></h2>
          <p>
            Take a picture from your phone, and Realness creates a vector
            graphic composed into five animatable layers; from a bright
            background to a dark foreground.
          </p>
          <p>
            This is a serviece for people who want to trust each other and
            commited to the dicipline and work to make that happen.
          </p>
          <p>
            Your Poster is a natural fit for the web. Posters are optimized to
            be expressive, small, and to run fast. You can extract a color
            palette, animate a filter or gradient. The individual parts of a
            Poster are easy to query and feel natural to access and manipulate.
          </p>
          <h4>
            Animators, Designers, Hand coders —
            <strong>Realness</strong> was built for you.
          </h4>
        </header>
      </section>
      <ol>
        <li>
          <icon name="finished" />
          <p>Supremely animatable vector graphics</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Powerfull workflow into Procreate Dreams</p>
        </li>
        <li>
          <icon name="finished" />
          <p>View Posters in a timeline with your comments</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Use the parts of your posters as masks and patterns</p>
        </li>

        <li>
          <icon name="finished" />
          <p>
            Realtime graphics settings to view each poster in your feed with an
            embossed edge and/or subtle animation
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            Works great on your iPad – Split view and export right into Affinity
            Designer
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            High performance masking and smart use of opacity to merge the
            colors between each of five layers of detail creating a natural
            sense of movement and life
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            Use any one of eighteen gradients generated from your posters
            prominant colors
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            Graphics are optimized to look great on all devices. No other design
            tools are required to use a realness poster
          </p>
        </li>
      </ol>
    </article>
    <article class="networks">
      <header><h2>Churches, Punks, and Veterans</h2></header>
      <section>
        <as-figure v-if="posters.length" :itemid="posters[2]?.id" />
        <header>
          <h2>Shared values</h2>
          <p>
            You can create your own social network with realness. Use it with
            your design team as a fun way to play and be creative. While easy to
            administer Realness encourages internet literacy. The time and
            investment you put into a realness of your own helps you understand
            the power of the internet.
          </p>
          <p>
            Use it with just your family, union hall, or maybe your
            <a href="https://youtu.be/05YRMHWtv1Y">warhammer</a>
            nerdpocalypse users group. Realness set's you up with all the
            benifits of a serverless web application to advantage intimate
            useful communities with clear lines of responsibility and
            communication. There is joy in our care for the maintenance and
            content on the web.
          </p>
          <p>
            The performance is over. Our social health requires more realness
            online
          </p>
          <h4>Let's be fun again</h4>
        </header>
      </section>
      <ol>
        <li>
          <icon name="finished" />
          <p>Sign in with your phone number</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Clear lines of responsibility</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Supports decentralized decision making</p>
        </li>
        <li>
          <icon name="finished" />
          <p>Low resolution graphics support natural human dynamics</p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            Nurtures web literacy. from command line to the power of firebase
          </p>
        </li>

        <li>
          <icon name="finished" />
          <p>
            Easy to administer with direct support from the development team
          </p>
        </li>
        <li>
          <icon name="finished" />
          <p>PWA means realness is unindexed by search engines</p>
        </li>
        <li>
          <icon name="finished" />
          <p>
            Designed to encourage enough internet literacy to empower regular
            ass people to help manage the web
          </p>
        </li>

        <li>
          <icon name="finished" />
          <p>
            <b class="no">Email</b>, <b class="no">Likes</b>,
            <b class="no">Links</b>,
            <b class="no">SEO</b>
          </p>
        </li>
      </ol>
    </article>
    <article class="developers">
      <header><h2>Developers</h2></header>
      <section>
        <as-figure v-if="posters.length" :itemid="posters[3]?.id" />

        <header>
          <h2>HTML is Our Database</h2>

          <p>
            Realness is a way and a support system to help you build web
            applications.
          </p>
          <p>
            It's natural to build web applications with HTML, especially for
            <i>Edge first</i>. Orienting to this has helped Realness take
            advantage of what's possible on the web today. How you build your
            app can create opportunities over the monetized client-server model
            we are used to today.
          </p>
          <p>
            Edge first is native, fast, more secure, and gives you choices
            around data storage that don't exist traditionally. With an
            Edge-first approach, you can make a quick and seamless transition
            from a User Experience demo to product development.
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
            involved. All this using only HTML, CSS, and JavaScript.
          </p>
          <p>
            Can a single developer provide a service all can use? Scott Fryxell
            is the developer behind Realness, and that's what I'm trying to find
            out.
          </p>
          <p>
            Sign into Realness, and you can message me directly. Visit the code
            <a href="https://github.com/realness-online/web" rel="external"
              >online</a
            >. I keep a
            <a href="https://scott-fryxell.github.io/" rel="external"> blog </a>
            of all my feelings and nerd problems. My resume is on there.
          </p>
          <h4>Cyber the App Store</h4>
        </header>
      </section>
      <ol>
        <li>
          <icon name="finished"></icon>
          <p>
            <a href="https://github.com/realness-online/web" rel="external">
              Open Source
            </a>
            utilizing modern best practices, with semantic HTML described using
            microdata.
          </p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>
            Build complete applications without the backend having to keep up or
            coordinate.
          </p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>
            Codebase prioritizes readability and accessibility friendliness.
          </p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>As simple or complex as your app requires.</p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>
            Opinionated: Tailwind and TypeScript are anti-patterns. CSS to the
            rescue!
          </p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>Runtime type validation</p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>
            Eliminate CSS crosstalk and improve legibility with fragment
            identifiers and child selectors.
          </p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>Reduced attack surface — Leave sensitive data on the device.</p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>Server is auth and storage only, no backend processes required.</p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>Affirms the infinite nature of the web.</p>
        </li>
        <li>
          <icon name="finished"></icon>
          <p>Your projects live under ${name}.web.app.</p>
        </li>
      </ol>
    </article>
    <call-to-action />
    <section>
      <header>
        <h2>Gallery</h2>
        <preference name="fill" />
        <preference name="cutout" />
        <preference name="drama" />
        <preference name="stroke" />
        <preference name="animate" />
      </header>
      <as-figure
        v-for="poster in posters"
        :key="poster.id"
        :itemid="poster.id" />
    </section>
    <footer>
      <logo-as-link />
      <call-to-action />
    </footer>
  </section>
</template>

<style lang="stylus">
  section.page#about
    max-width: 1600px
    fieldset.preference
      margin-bottom: base-line
    .no
      text-decoration: line-through
    svg.icon
      fill: green
    & > header
      display: block
      & > nav
        display: flex
        justify-content: space-between
        margin-bottom: base-line * 2
        & > a > span
          font-size:small
          font-weight: 400
          color: green
        svg.icon
          fill: blue
      & > section.hero
        @media (min-width: pad-begins)
          display: flex
          justify-content: space-around
          align-items: stretch
        & > header
          padding: base-line
          @media (min-width: pad-begins)
            margin-top: base-line * 2
            width: base-line * 22
          & > h1
            color: blue
            margin: 0
            text-align: center
            @media (min-width: pad-begins)
              text-align: left
          & > h3
            max-width: base-line * 10
            @media (min-width: pad-begins)
              max-width: inherit
            text-align: right;
            margin:0
            color:green
          & > p
            margin-top: base-line
            text-align: center;
        & > figure.poster
          @media (min-width: pad-begins)
            flex: 1
            min-width: 0
            height: 100%
          &:has(svg.landscape)
            @media (min-width: pad-begins)
              height: 100%
          & > svg
            transition: transform 2s
            transform-style: preserve-3d
            // transform: rotateY( 180deg )
            display: block
            border-radius: base-line
            width: 100%
            height: 100%
    & > menu
      border-radius: base-line
      display: flex
      justify-content: space-between
      padding base-line
      @media (min-width: pad-begins)
        margin: base-line
        justify-content: center
      & > button
        border-radius: base-line * 0.33
        color: green
        background-color: white
        font-weight: bold
        max-width: 10rem
        line-height: 1.33
        @media (prefers-color-scheme: dark)
          background-color: black
        @media (min-width: pad-begins)
          margin 0 base-line
        &[aria-selected=false]
          border-color: transparent
          background-color: transparent
          font-size: smaller
          text-shadow 1px 1px transparent
          @media (min-width: pad-begins)
            font-size: larger
        &[aria-selected=true]
          font-size: smaller
          color: #ffffff
          text-shadow 1px 1px green
          @media (min-width: pad-begins)
            font-size: larger
          @media (prefers-color-scheme: dark)
            color: white
    & > article
      margin: base-line 0
      padding: base-line
      & > header
        display: flex
        justify-content: center
        margin-bottom:  base-line * 2
        & > h2
          font-size: base-line * 3
          width: 100%
          max-width: base-line * 22
          text-align: center
          color: red
      & > section
        @media (min-width: pad-begins)
          padding: base-line
          display: flex
          align-items: stretch
        & > figure.poster
          @media (min-width: pad-begins)
            flex: 1
            min-width: 0
            height: 100%
          &:has(svg.landscape)
            @media (min-width: pad-begins)
              height: 100%
          & > svg
            border-radius: base-line * 0.33
            width: 100%
            height: 100%
        & > header
          display: flex
          flex-direction: column
          @media (min-width: pad-begins)
            padding: 0 base-line
          strong
            color:blue
          & > h2
            margin-bottom: base-line *3
          & > h4
            margin-top: base-line
            margin-bottom: base-line * 2
            text-align: center
            line-height: 2
            max-width: base-line * 13
            align-self: center
          & > ol
            list-style-type: square
            & > li
              margin-left: base-line

      & > ol
        display: grid
        grid-gap: base-line
        grid-template-columns: repeat(auto-fill, minmax(325px, 1fr))
        @media (min-width: pad-begins)
          padding: base-line
        li
          position: relative
          display: block
          svg
            position: absolute
          p
            margin-left: base-line * 2
            margin-bottom: 0
    & > section
      padding: base-line
      // min-height: 100vh
      standard-grid: gentle
      & > header
        width: 100%
      & > figure.poster
        min-height: 0
        display: flex
        flex-direction: column
        & > svg
          flex: 1
          min-height: 0
      & > svg
        border-radius: base-line * 0.21
        height: 100%
        width: 100%
      & > svg.landscape
        padding: 0
        @media (min-width: pad-begins)
          grid-column-start: span 2
      & > svg.landscape + .landscape
        @media (min-width: pad-begins)
          grid-column-start: span 3
      @media (orientation: landscape), (min-width: page-width)
        & > img.landscape
          border:1em solid blue
          grid-column-start: span 2
    & > footer
      display: block
      min-height: 100vh
      padding: base-line
      & > a.logo
        display: inline-block
</style>
