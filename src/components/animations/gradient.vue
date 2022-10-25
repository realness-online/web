<template>
  <animate
    attributeName="gradientTransform"
    dur="2s"
    values="rotate(0); rotate(-30deg); rotate(0);"
    keyTimes="0; .21; 1"
    calcMode="spline"
    keySplines=".5 0 .34 1; 0 .21 .34 1"
    repeatCount="indefinite" />
</template>
