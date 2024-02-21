<template>
  <svg width="100%" height="100%">
    <defs>
      <pattern
        id="tile"
        patternUnits="userSpaceOnUse"
        width="75"
        height="75"
        viewBox="0 0 50 50">
        <line x1="1" y1="0" x2="51" y2="50" stroke="#19203d" stroke-width="2" />
        <line
          x1="49"
          y1="0"
          x2="-1"
          y2="50"
          stroke="#19203d"
          stroke-width="2" />
        <line x1="50" y1="0" x2="0" y2="50" stroke="#313763" stroke-width="2" />
        <line x1="0" y1="0" x2="50" y2="50" stroke="#313763" stroke-width="2" />
      </pattern>
      <radialGradient id="l" cx="50%" cy="200%" fy="0" r="201%">
        <stop offset="0%" style="stop-color: #fff; stop-opacity: 0.1" />
        <stop offset="10%" style="stop-color: #000; stop-opacity: 0.1" />
        <stop offset="30%" style="stop-color: #000; stop-opacity: 0.3" />
        <stop offset="90%" style="stop-color: #000; stop-opacity: 0.55" />
        <stop offset="100%" style="stop-color: #000; stop-opacity: 0.6" />
      </radialGradient>
      <rect id="bgRect" fill="#39466b" width="100%" height="100%" />
      <rect id="gradientRect" fill="url(#l)" width="100%" height="100%" />
      <rect id="tileRect" fill="url(#tile)" width="100%" height="100%" />

      <filter id="test" color-interpolation-filters="sRGB" y="0">
        <feImage href="#bgRect" result="bg" />
        <feImage href="#tileRect" result="tile" />
        <feImage href="#gradientRect" result="waves" />
        <feMerge>
          <feMergeNode in="bg" />
          <feMergeNode in="tile" />
          <feMergeNode in="waves" />
        </feMerge>
      </filter>
      <filter id="rough-it-up">
        <feTurbulence
          baseFrequency="0.1"
          type="fractalNoise"
          numOctaves="2"
          seed="83"
          in="flood" />
        <feFlood
          flood-color="rgba(0,0,0,0.5)"
          flood-opacity="0.91"
          result="flood" />
        <feBlend in="flood" in2="SourceGraphic" />
      </filter>
    </defs>
    <rect filter="url(#test)" width="100%" height="100%" />
  </svg>
</template>
