<script setup>
  defineProps({
    active: { type: Boolean, default: false }
  })
</script>

<template>
  <div
    class="working-border"
    :class="{ 'is-active': active }"
    aria-hidden="true">
    <div class="working-border__spin" />
  </div>
</template>

<style>
  div.working-border {
    --ring: clamp(0.26rem, calc(0.18rem + 0.95vmin), min(0.58rem, 1.5vmin));
    --ring-corner: clamp(0.5rem, calc(var(--ring) * 1.35), min(1rem, 2.5vmin));
    --sweep-gap-start: 275deg;
    --sweep-peak: 290deg;
    --sweep-gap-end: 304deg;

    position: fixed;
    top: env(safe-area-inset-top, 0px);
    right: env(safe-area-inset-right, 0px);
    bottom: env(safe-area-inset-bottom, 0px);
    left: env(safe-area-inset-left, 0px);
    box-sizing: border-box;
    padding: var(--ring);
    border-radius: var(--ring-corner);
    pointer-events: none;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    -webkit-mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
    -webkit-mask-clip: content-box, border-box;
    -webkit-mask-origin: border-box, border-box;
    -webkit-mask-composite: xor;
    mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
    mask-clip: content-box, border-box;
    mask-origin: border-box, border-box;
    mask-composite: exclude;
  }

  div.working-border.is-active {
    opacity: 1;
    visibility: visible;
  }

  div.working-border:not(.is-active) .working-border__spin {
    animation-play-state: paused;
  }

  div.working-border__spin {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 280vmax;
    height: 280vmax;
    transform-origin: center center;
    will-change: transform;
    backface-visibility: hidden;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      transparent var(--sweep-gap-start),
      var(--blue) var(--sweep-peak),
      transparent var(--sweep-gap-end),
      transparent 360deg
    );
    animation-name: working-edge-sweep;
    animation-duration: 2.5s;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  @media (min-width: 1024px) and (pointer: fine) {
    div.working-border {
      --ring: clamp(0.24rem, calc(0.12rem + 0.65vmin), 0.42rem);
      --ring-corner: clamp(0.4rem, calc(var(--ring) * 1.35), 0.8rem);
      --sweep-gap-start: 285deg;
      --sweep-peak: 290deg;
      --sweep-gap-end: 295deg;
    }

    div.working-border__spin {
      animation-duration: 3.4s;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    div.working-border__spin {
      animation: none;
      transform: translate(-50%, -50%) rotate(42deg);
      opacity: 0.82;
    }
  }
</style>
