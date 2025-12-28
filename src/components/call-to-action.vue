<template>
  <div class="call to action">
    <h3>
      Support
      <a
        href="https://patreon.com/scottfryxell"
        target="_blank"
        rel="noopener noreferrer">
        <h1>Realness</h1>
        <h3>online</h3>
      </a>
    </h3>
    <p>
      <strong>The medium is the message</strong>
    </p>
  </div>
</template>

<style lang="stylus">
  div.call.to.action
    margin:auto
    max-width: base-line * 18rem
    padding: base-line * 1.5
    @media (min-width: pad-begins)
      display: flex
      flex-direction: column
      justify-content: center
      align-items: center
    svg.icon
      fill: blue
    & > h3
      margin-bottom: 0
      & > a
        padding-right: base-line * 0.25
        color: red
        min-width: 50dvw
        & > h1
          font-weight: 300
          margin: 0
          text-align: center
          @media (min-width: pad-begins)
            text-align: left
        & > h3
          max-width: base-line * 10
          text-align: right
          margin: 0
          color: green
          @media (min-width: pad-begins)
            max-width: inherit
    & > p
      display: flex
      margin-bottom: base-line * 2
      max-width: base-line * 18rem
      text-align: center
      & > strong
        text-transform: capitalize
        color: blue
        font-weight: normal
        margin-right: base-line * .5
</style>
