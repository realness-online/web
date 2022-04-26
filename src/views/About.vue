<template>
  <section id="about" class="page">
    <header>
      <nav>
        <logo-as-link />
      </nav>
      <figure>
        <figcaption>
          <h1>Realness</h1>
          <h3>online</h3>
          <p>
            Realness creates expressive vector graphics from your designs and
            photos. It works on any device.
          </p>
          <p>
            Once you edit and save your creations, they will integrate into any
            workflow that uses SVG.
          </p>
        </figcaption>
        <img class="example" :src="`/about/landscape/06.svg`" />
      </figure>
    </header>
    <tab-group>
      <tab-list as="menu">
        <tab>For Designers</tab>
        <tab>For Churches, Punks, and Veterans</tab>
        <tab>For Developers</tab>
      </tab-list>
      <tab-panels as="template">
        <tab-panel class="designers" as="article" tabIndex="-1">
          <figure>
            <img class="example" src="/about/portrait/09.svg" />
            <figcaption>
              <h3>We call them <b>posters</b></h3>
              <p>
                Your image is composed into four animatable layers, From a white
                background to a dark foreground.
              </p>
              <p>
                Once created, your poster is optimized to be small and run fast.
                Realness has tools for you to edit opacity, color, gradient for
                the fill and stroke of each layer.
              </p>
              <p>
                Download your poster and you can extract a color pallet. Animate
                a filter or gradient. the individual parts of a Poster are easy
                to query and feel natural to mainipulate for the web.
              </p>
              <p>Hand coders — <b>Realness</b> was built for you.</p>
              <h4>A tool at the creative limits of the web</h4>
            </figcaption>
          </figure>
          <ol>
            <li>
              <icon name="finished" />
              <p>
                Edit color, gradient and opacity for symbols <b>Background</b>,
                <b>Light</b>, <b>Regular</b> and <b>Bold</b>
              </p>
            </li>
            <li>
              <icon name="finished" />
              <p>View Posters in a timeline with your comments</p>
            </li>
            <li>
              <icon name="finished" />
              <p>
                Each poster is a document you can download, read, and animate
              </p>
            </li>
            <li>
              <icon name="finished" />
              <p>
                Symbols make it possible to use posters as masks and patterns
              </p>
            </li>
            <li>
              <icon name="finished" />
              <p>
                Extract filters, and any one of six gradients from your poster
              </p>
            </li>
            <li>
              <icon name="finished" />
              <p>Access posters from your filesystem</p>
            </li>
          </ol>
        </tab-panel>
        <tab-panel class="networks" as="article" tabIndex="-1">
          <figure>
            <img class="example" src="/about/portrait/02.svg" />
            <figcaption>
              <h2>The real us</h2>
              <p>
                Social media is a Mall. There are communities that we are apart
                of that exist outside of the market. Realness is for communities
                with ideals and principles around doing it yourself.
              </p>
              <p>
                Independent people and organizations can use Realness to create
                social networks of their own.
              </p>
            </figcaption>
          </figure>
          <ol>
            <li>
              <icon name="finished" />
              <p>
                Sign in with your phone number to sync.
                <span class="not">No email</span>
              </p>
            </li>
          </ol>
        </tab-panel>
        <tab-panel class="developers" as="article" tabIndex="-1">
          <figure>
            <img class="example" src="/about/portrait/03.svg" />
            <figcaption>
              <h2>Built on the edge</h2>
              <p>
                <span class="realness">Realness</span> takes advantage of
                serverless to deliver a superior experence and create
                oportunities for products beyond today's web
              </p>
              <p>
                Developers can use realness to free themselves from SQL and the
                tyrany of elite developers who have used the backend to
                <a href="https://meta.com">reak havoc</a> for profit.
              </p>
              <a href="https://github.com/realness-online/web" rel="external">
                Open Source
              </a>
            </figcaption>
          </figure>
          <ol>
            <li>
              <icon name="finished" />
              <p>
                Sign in with your phone number to sync.
                <span class="not">No email</span>
              </p>
            </li>
          </ol>
        </tab-panel>
      </tab-panels>
    </tab-group>
    <div class="call to action">
      <h2>Support <span>Realness</span></h2>
      <h3>$5 for Designers</h3>
      <a href="https://cash.app/$ScottFryxell">
        <img src="/about/cash-app.jpg" />
      </a>
      <p>Realness is free. There are no reciepts</p>
    </div>
    <footer>
      <figure>
        <figcaption>
          <h2>Gallery</h2>
        </figcaption>
      </figure>
    </footer>
  </section>
</template>
<script setup>
  import { ref } from 'vue'
  import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue'
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  const current_picture = ref(16)
</script>
<style lang="stylus">
  section.page#about
    span, b
      color: blue
    span.not
      text-decoration: line-through
    svg.icon
      fill: green
      width: base-line
      height: base-line
    & > header
      display: block
      min-height: 100vh
      // overflow: hidden
      // perspective: 1000px
      // overflow-x: hidden
      & > nav
        display: flex
        justify-content: space-between
        margin-bottom: base-line * 2
        svg.icon
          fill: blue
      & > figure
        perspective: base-line * 80
        @media (min-width: pad-begins)
          display: flex
          justify-content: space-around
        & > figcaption
          padding: base-line
          @media (min-width: pad-begins)
            margin-top: base-line * 2
            width:33%
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
        & > img
          transition: transform 2s
          transform-style: preserve-3d
          // transform: rotateY( 180deg )
          display: block
          border-radius: base-line
          @media (min-width: pad-begins)
            width: 50vw
    & > menu
      border-radius: base-line
      display: flex
      justify-content: space-between
      margin-top: base-line
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
        &[aria-selected=true]
          font-size: larger
          color: #ffffff
          text-shadow 1px 1px green
          @media (prefers-color-scheme: dark)
            color: white
    & > article
      min-height: 100vh
      padding: base-line
      & > header > h3
        margin-bottom:  base-line * 2
      & > figure
        & > img
          border-radius: base-line * 0.33
        @media (min-width: pad-begins)
          padding: base-line
          display: flex
          & > img
            width: 40vw
        & > figcaption
          padding: base-line
          display: flex
          flex-direction: column
          & > h4
            margin-top: base-line
            text-align: center
            line-height: 2
            max-width: base-line * 13
            align-self: center
          & > ol
            list-style-type: square
            & > li
              margin-left: base-line

      & > ol
        padding: base-line
        display: grid
        grid-gap: base-line
        grid-template-columns: repeat(auto-fill, minmax(325px, 1fr))
        li
          position: relative;
          display: block
          svg
            position: absolute
          p
            margin-left: base-line * 2
            margin-bottom: 0
    & > div.call.to.action
      padding: base-line * 2
      min-height: 100vh
      display: flex
      flex-direction: column;
      justify-content: center;
      align-items: center;
      & > h2 > span
        color: blue
      h3
        margin-bottom: base-line * 3
        color: green
      img
        border-radius: base-line
        width: base-line * 12
      p
        margin-top: base-line * 3
        max-width: base-line * 18rem
        text-align: center
    & > footer
      padding: base-line * 2
      min-height: 100vh
</style>
