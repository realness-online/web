<template>
  <defs itemprop="filters">
    <filter id="bold-filter">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0.00 0
                0 1 0 0.00 0
                0 0 1 0.00 0
                0 0 0 2.75 0" />
    </filter>
    <filter id="emboss">
      <feConvolveMatrix
        kernelMatrix="3 0 0
                      0 0 0
                      0 0 -3" />
    </filter>
  </defs>
</template>
