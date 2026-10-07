<template>
  <aside data-call-to-action>
    <h3>
      Support
      <router-link to="/pricing">
        <h1>Realness</h1>
        <h3>online</h3>
      </router-link>
    </h3>
    <p>
      <strong>The medium is the message</strong>
    </p>
  </aside>
</template>

<style lang="stylus">
  aside[data-call-to-action] {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: auto;
    max-width: base-line * 18rem;
    padding: base-line * 1.5;
    & > h3 {
      margin-bottom: 0;
      & > a {
        padding-right: base-line * 0.25;
        color: var(--emphasis);
        min-width: 50dvw;
        text-decoration: none;
        & > h1 {
          font-weight: 300;
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
          color: var(--accent);
          @media (min-width: pad-begins) {
            max-width: inherit;
          }
        }
      }
    }
    & > p {
      display: flex;
      margin-bottom: base-line * 2;
      max-width: base-line * 18rem;
      text-align: center;
      & > strong {
        text-transform: capitalize;
        color: var(--accent);
        font-weight: normal;
        margin-right: base-line * .5;
      }
    }
  }
</style>
