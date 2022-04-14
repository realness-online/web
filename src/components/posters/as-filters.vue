<template>
  <defs>
    <filter id="light-filter">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1.5 0 0 0 0
                0 1.25 0 0 0
                0 0 1 0 0
                0 0 0 1 0" />
    </filter>
    <filter id="regular-filter">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1.5 0 0 0 0
                0 1.25 0 0 0
                0 0 1 0 0
                0 0 0 1.5 0" />
    </filter>

    <filter id="bold-filter">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 3 0" />
    </filter>

    <filter id="emboss">
      <feConvolveMatrix
        kernelMatrix="3 0 0
                      0 0 0
                      0 0 -3" />
    </filter>
  </defs>
</template>
