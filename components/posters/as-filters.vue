<template>
  <defs class="filters">
    <filter id="light-filter">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1.5 0 0 0 0
                0 1.5 0 0 0
                0 0 1.5 0 0
                0 0 0 1.5 0" />
    </filter>
    <filter id="regular-filter">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1.5 0 0 0 0
                0 1.5 0 0 0
                0 0 1.5 0 0
                0 0 0 1 0" />
    </filter>

    <filter id="bold-filter">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 1 0" />
    </filter>

    <filter id="emboss">
      <feConvolveMatrix
        kernelMatrix="1 0 0
                      0 0 0
                      0 0 -1" />
    </filter>
  </defs>
</template>
<!-- todo check to include on the page via documebnt.getItemById. this way we only include it once on the page.
    will need to verify that this gets saved when svg is downloaded -->
