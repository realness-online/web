<script setup>
  // This is only for the Inputs to work dynamically

  function setTheme(H, inputType) {
    // Convert hex to RGB first
    let r = 0,
      g = 0,
      b = 0
    if (H.length == 4) {
      r = `0x${  H[1]  }${H[1]}`
      g = `0x${  H[2]  }${H[2]}`
      b = `0x${  H[3]  }${H[3]}`
    } else if (H.length == 7) {
      r = `0x${  H[1]  }${H[2]}`
      g = `0x${  H[3]  }${H[4]}`
      b = `0x${  H[5]  }${H[6]}`
    }
    // Then to HSL
    r /= 255
    g /= 255
    b /= 255
    let cmin = Math.min(r, g, b),
      cmax = Math.max(r, g, b),
      delta = cmax - cmin,
      h = 0,
      s = 0,
      l = 0

    if (delta == 0) h = 0
    else if (cmax == r) h = ((g - b) / delta) % 6
    else if (cmax == g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4

    h = Math.round(h * 60)

    if (h < 0) h += 360

    l = (cmax + cmin) / 2
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
    s = +(s * 100).toFixed(1)
    l = +(l * 100).toFixed(1)

    document.documentElement.style.setProperty(`--${inputType}-color-h`, h)
    document.documentElement.style.setProperty(
      `--${inputType}-color-s`,
      `${s  }%`
    )
    document.documentElement.style.setProperty(
      `--${inputType}-color-l`,
      `${l  }%`
    )
  }

  const inputs = ['primary', 'secondary']

  inputs.forEach(inputType => {
    document
      .querySelector(`#${inputType}-color-input`)
      .addEventListener('change', e => {
        setTheme(e.target.value, inputType)
      })
  })
</script>

<template>
  <h1>Pure CSS Color Theming 🎨</h1>
  <div class="box-container">
    <div class="box-container">
      <div class="box primary"><p>Primary (Base)</p></div>
      <div class="box primary-light">
        <p>Primary Light</p>
        <p />
      </div>
      <div class="box primary-dark"><p>Primary Dark</p></div>
      <div class="box primary-complement"><p>Primary Complement</p></div>
      <div class="box primary-triad-1"><p>Primary Triad 1</p></div>
      <div class="box primary-triad-2"><p>Primary Triad 2</p></div>
    </div>
    <div class="box-container">
      <div class="box secondary">Secondary (Base)</div>
      <div class="box secondary-light">Secondary Light</div>
      <div class="box secondary-dark">Secondary Dark</div>
      <div class="box secondary-complement">Secondary Complement</div>
      <div class="box secondary-triad-1"><p>Secondary Triad 1</p></div>
      <div class="box secondary-triad-2"><p>Secondary Triad 2</p></div>
    </div>
  </div>

  <fieldset class="controls">
    <legend>Select Base Values:</legend>
    <div>
      <input id="primary-color-input" type="color" value="#6400f0" />
      <label for="primary-color-input">Primary</label>
    </div>
    <div>
      <input id="secondary-color-input" type="color" value="#018989" />
      <label for="secondary-color-input">Secondary</label>
    </div>
  </fieldset>
</template>

<style lang="stylus">
  :root {
    /*  Base Values  */
    --primary-color-h: 265;
    --primary-color-s: 100%;
    --primary-color-l: 47%;
    --secondary-color-h: 180;
    --secondary-color-s: 99%;
    --secondary-color-l: 27%;
    --contrastThreshold: 60%;

    /*  Calculations Based on Lightness  */
    --lightnessTransform: 10%;
    --darknessTransform: 15%;
    --primary-color-light-l: calc(var(--primary-color-l) + var(--lightnessTransform));
    --primary-color-dark-l: calc(var(--primary-color-l) - var(--darknessTransform));
    --secondary-color-light-l: calc(var(--secondary-color-l) + var(--lightnessTransform));
    --secondary-color-dark-l: calc(var(--secondary-color-l) - var(--darknessTransform));

    --color-primary: hsl(var(--primary-color-h),
                         var(--primary-color-s),
                         var(--primary-color-l));
    --color-secondary: hsl(var(--secondary-color-h),
                         var(--secondary-color-s),
                         var(--secondary-color-l));
    --color-primary-dark:hsl(var(--primary-color-h),
                         var(--primary-color-s),
                         var(--primary-color-dark-l));
    --color-secondary-dark:hsl(var(--secondary-color-h),
                         var(--secondary-color-s),
                         var(--secondary-color-dark-l));
    --color-primary-light:hsl(var(--primary-color-h),
                         var(--primary-color-s),
                         var(--primary-color-light-l));
    --color-secondary-light:hsl(var(--secondary-color-h),
                         var(--secondary-color-s),
                         var(--secondary-color-light-l));

    /*  Calculations Based on Hue  */
    --color-primary-complement: hsl(calc(var(--primary-color-h) + 180),
                            var(--primary-color-s),
                            var(--primary-color-l));
    --color-primary-triad-1: hsl(calc(var(--primary-color-h) + 120),
                            var(--primary-color-s),
                            var(--primary-color-l));
    --color-primary-triad-2: hsl(calc(var(--primary-color-h) - 120),
                            var(--primary-color-s),
                            var(--primary-color-l));
    --color-secondary-complement: hsl(calc(var(--secondary-color-h) + 180),
                            var(--secondary-color-s),
                            var(--secondary-color-l));
    --color-secondary-triad-1: hsl(calc(var(--secondary-color-h) + 120),
                            var(--secondary-color-s),
                            var(--secondary-color-l));
    --color-secondary-triad-2: hsl(calc(var(--secondary-color-h) - 120),
                            var(--secondary-color-s),
                            var(--secondary-color-l));
  }

  /*  Apply Color to Boxes */

  .primary {
    background: var(--color-primary);

    --switch: calc((var(--primary-color-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .primary-light {
    background: var(--color-primary-light);
    --switch: calc((var(--primary-color-light-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .primary-dark {
    background: var(--color-primary-dark);
    --switch: calc((var(--primary-color-dark-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .primary-complement {
    background: var(--color-primary-complement);
    --switch: calc((var(--primary-color-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .primary-triad-1 {
    background: var(--color-primary-triad-1);
    --switch: calc((var(--primary-color-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .primary-triad-2 {
    background: var(--color-primary-triad-2);
    --switch: calc((var(--primary-color-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .secondary {
    background: var(--color-secondary);
    --switch: calc((var(--secondary-color-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .secondary-light {
    background: var(--color-secondary-light);
    --switch: calc((var(--secondary-color-light-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .secondary-dark {
    background: var(--color-secondary-dark);
    --switch: calc((var(--secondary-color-dark-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .secondary-complement {
    background: var(--color-secondary-complement);
    --switch: calc((var(--secondary-color-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .secondary-triad-1 {
    background: var(--color-secondary-triad-1);
    --switch: calc((var(--secondary-color-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  .secondary-triad-2 {
    background: var(--color-secondary-triad-2);
    --switch: calc((var(--secondary-color-l) - var(--contrastThreshold)) * -100);
    color: hsl(0, 0%, var(--switch));
  }

  /*  Etc */
  .box-container {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    justify-content: center;

  }

  .controls {
    margin-top: 1rem;
    padding: 1rem 2rem;
    border-color: #bbb;
    border-style: dashed;
  }

  .controls div {
    width: 100px;
    text-align: center;
    display: inline-block;
  }

  legend {
    padding: 0 1rem;
  }

  .box {
    height: 100px;
    flex: 1;
    flex-basis: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
    position: relative;
    border-radius: 10px;
    text-align: center;
    padding: 0 0.25rem;
  }

  body {
    font-family: 'Roboto', serif;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-family: 'Roboto Mono', monospace;
  }

  html {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  input[type="color"] {
    border: 2px solid;
    padding: 0;
    vertical-align: middle;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    overflow: hidden;
    cursor: pointer;
  }
  input[type="color"]::-webkit-color-swatch-wrapper {
  	padding: 0;
  }
  input[type="color"]::-webkit-color-swatch {
  	border: none;
  }
</style>
