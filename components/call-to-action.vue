<template>
  <div class="call to action">
    <h3>
      Support
      <a href="https://patreon.com/scottfryxell" target="_blank">
        <h1>Realness</h1>
        <h3>online</h3>
      </a>
    </h3>
    <p>
      <strong>Free for everyone</strong>
    </p>
  </div>
</template>
<style lang="stylus">
  div.call.to.action
    padding: base-line * 2
    min-height: 100vh
    display: flex
    flex-direction: column
    justify-content: center
    align-items: center
    svg.icon
      fill: blue
    & > h3
      margin-bottom: base-line
      & > a
        padding-right: base-line * 0.25
        color: blue
        min-width: 50vw
        & > h1
          color: blue !important
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
      margin-top: base-line
      max-width: base-line * 18rem
      text-align: center
      & > strong
        color: red
        margin-right: base-line * .5
</style>
