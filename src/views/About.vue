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
              <h2>Shared values</h2>
              <p>
                You can create your own social network with realness. While easy
                to administer realenss encourages internet literacy. The time
                and investment you put into realness helps you understand the
                internet
              </p>
              <p>
                This means creating and managing an instance of realness is
                going to require taking responcibilty for it's maintenance and
                content.
              </p>
              <p>
                Use it with just your family, or maybe your warhammer
                nerdacalypse user group. Realness set's you up with all the
                benifits of serverless to advantage intimate useful communities
                with clear lines of responsibility and communication
              </p>
              <p>
                The performance is over. Our social health requires more
                realness online. Realness has extensive documentation and you
                can join the network if you want to talk with the team.
              </p>
              <h4>Let's be fun again</h4>
            </figcaption>
          </figure>
          <ol>
            <li>
              <icon name="finished" />
              <p>Low resolution graphics support natural human dynamics</p>
            </li>
            <li>
              <icon name="finished" />
              <p>Clear lines of responcibility</p>
            </li>
            <li>
              <icon name="finished" />
              <p>Supports decentralized decision making</p>
            </li>
            <li>
              <icon name="finished" />
              <p>
                Easy to administer with direct support from the development team
              </p>
            </li>
            <li>
              <icon name="finished" />
              <p>
                Designed to encourage enough internet literacy to empower
                regular ass people help manage the web
              </p>
            </li>
            <li>
              <icon name="finished" />
              <p>Usefull to learn. Built on top of firebase</p>
            </li>

            <li>
              <icon name="finished" />
              <p>Organized around voting with your participation</p>
            </li>
            <li>
              <icon name="finished" />
              <p>Sign in with your phone number</p>
            </li>
            <li>
              <icon name="finished" />
              <p>
                <b class="no">Email</b>, <b class="no">Likes</b>,
                <b class="no">Links</b>
              </p>
            </li>
          </ol>
        </tab-panel>
        <tab-panel class="developers" as="article" tabIndex="-1">
          <figure>
            <img class="example" src="/about/portrait/03.svg" />
            <figcaption>
              <h2>HTML is our database</h2>
              <p>
                <span class="realness">Realness</span> takes advantage of
                serverless to deliver a superior experence and create
                oportunities for customers and developers based on internet
                literacy. We argue that we have to build an open web. Built on a
                web of trust between communities.
              </p>
              <p>
                Developers can use realness to free themselves from SQL and the
                tyrany of a full-stack mindset.
              </p>
              <p>
                you pay when your ready, and if it feels apropriate. This helps
                keep the developers of realness focused on their job.
              </p>
              <p>Crypto is fake scarcity. bro.</p>
              <h4>Cyber</h4>
            </figcaption>
          </figure>
          <ol>
            <li>
              <icon name="finished" />
              <p>
                <a href="https://github.com/realness-online/web" rel="external">
                  Open Source
                </a>
              </p>
            </li>
          </ol>
        </tab-panel>
      </tab-panels>
    </tab-group>
    <div class="call to action">
      <h3>
        Continued development of <span>Realness</span> <span>online</span>
      </h3>
      <h4>$5 — Designers</h4>
      <h4>$15 — Community</h4>
      <h4>$25 — Developers</h4>
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
    .no
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
          padding: 0 base-line
          display: flex
          flex-direction: column
          & > h4
            margin: base-line 0
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
      & > h2
        margin-bottom: 0
        & > span
          color: blue
      & > h3
        & > span:first-of-type
          color: blue
        & > span:last-of-type
          color: green
      h4
        margin: base-line
        color: green
        max-width: base-line * 13
        &:last-of-type
          margin-bottom: base-line * 2
      img
        border-radius: base-line
        width: base-line * 12
      p
        margin-top: base-line
        max-width: base-line * 18rem
        text-align: center
    & > footer
      padding: base-line * 2
      min-height: 100vh
</style>
