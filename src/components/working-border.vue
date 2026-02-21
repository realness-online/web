<template>
  <div class="working-border" aria-hidden="true" />
</template>

<style>
  div.working-border {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: calc(var(--base-line) * 3) solid transparent;
    border-radius: calc(var(--base-line) * 3);
    background:
      linear-gradient(transparent, transparent) padding-box,
      radial-gradient(ellipse at center, transparent 87%, var(--green) 95%)
        border-box;
    pointer-events: none;
    will-change: opacity, transform;
    transform: translateZ(0);
    backface-visibility: hidden;
    animation-name: pulsing;
    animation-duration: 2.33s;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  }
</style>
