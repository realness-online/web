<script setup>
  import { ref, onMounted as mounted } from 'vue'
  import css_var from '@/utils/css-var'

  defineOptions({ name: 'Colors' })

  const grounds = { light: 'chalk', dark: 'basalt', fill: 'paint' }

  const materials = [
    { name: 'water', note: 'hue 180 — the cool primary; was blue' },
    { name: 'clay', note: 'hue 0 — the warm half; was red' },
    { name: 'moss', note: 'hue 120 — in stock for success states' },
    { name: 'slate', note: 'hue 215 — a quieter companion to water' },
    { name: 'heather', note: 'hue 285 — the one flower on the hillside' }
  ]
  const variants = ['light', 'dark', 'fill']

  const signals = [
    { name: 'sulfur', note: 'warning — offline, the fps floor', ink: 'dark' },
    { name: 'ochre', note: 'caution — working states, mask pen', ink: 'dark' }
  ]
  const neutrals = [
    { name: 'sediment' },
    { name: 'sand', ink: 'dark' },
    { name: 'gravel' },
    { name: 'rocks' },
    { name: 'boulders' }
  ]
  const surfaces = [
    { name: 'chalk', note: 'light surface', ink: 'dark' },
    { name: 'bone', note: 'light poster', ink: 'dark' },
    { name: 'basalt', note: 'dark surface' },
    { name: 'atmosphere', note: 'depth behind everything' },
    { name: 'graphite', note: 'light text' }
  ]

  const resolved = ref({})

  mounted(() => {
    const tokens = materials.flatMap(({ name }) =>
      variants.map(variant => `--${name}-${variant}`)
    )
    tokens.push(
      ...[...signals, ...neutrals, ...surfaces].map(({ name }) => `--${name}`)
    )
    resolved.value = Object.fromEntries(
      tokens.map(token => [token, css_var(token).trim()])
    )
  })
</script>

<template>
  <section id="colors" class="page">
    <article>
      <header>
        <h1>Color</h1>
        <p>
          Materials, not hues. Roles, not colors. The palette is paint on the
          shelf and grows freely; roles are the jobs and grow reluctantly.
          Components only ever touch roles — the canvas and poster paint reach
          for materials directly.
        </p>
      </header>

      <h2>Roles</h2>
      <dl>
        <dt style="--paint: var(--accent)"><code>--accent</code></dt>
        <dd>
          <p>water — links, focus, interactive elements</p>
          <a href="/docs">A link finds the water</a>
        </dd>

        <dt style="--paint: var(--emphasis)"><code>--emphasis</code></dt>
        <dd>
          <p>clay — hover, selection, the warm half of the gradient</p>
          <label><input type="checkbox" checked /> selected</label>
        </dd>

        <dt style="--paint: var(--danger)"><code>--danger</code></dt>
        <dd>
          <p>clay alias — destructive actions; same paint, free to diverge</p>
          <output data-role="danger">remove</output>
        </dd>

        <dt style="--paint: var(--warning)"><code>--warning</code></dt>
        <dd>
          <p>sulfur — offline, the fps floor</p>
          <output data-role="warning">offline</output>
        </dd>

        <dt style="--paint: var(--caution)"><code>--caution</code></dt>
        <dd>
          <p>ochre — working and saving states</p>
          <output data-role="caution">saving</output>
        </dd>

        <dt style="--paint: var(--success)"><code>--success</code></dt>
        <dd>
          <p>moss — in stock, unassigned until a success state ships</p>
          <output data-role="success">in stock</output>
        </dd>
      </dl>

      <h2>Materials</h2>
      <p>
        Each material follows one recipe: a light value, a dark value lifted in
        lightness, and a mid fill for solids. Contrast is measured against the
        surface it sits on — chalk in light mode, basalt in dark.
      </p>
      <figure
        v-for="material in materials"
        :key="material.name"
        :data-material="material.name">
        <figcaption>
          <b>{{ material.name }}</b> <i>{{ material.note }}</i>
        </figcaption>
        <ul>
          <li
            v-for="variant in variants"
            :key="variant"
            :data-ground="grounds[variant]"
            :style="{ '--paint': `var(--${material.name}-${variant})` }">
            <samp>Aa</samp>
            <p>
              <small>{{ variant }}</small>
              <data :value="resolved[`--${material.name}-${variant}`]">
                {{ resolved[`--${material.name}-${variant}`] }}
              </data>
            </p>
          </li>
        </ul>
      </figure>

      <h2>Signals</h2>
      <p>
        High saturation, translucent, the same in both schemes — these interrupt
        rather than decorate.
      </p>
      <ul data-strip="signals">
        <li
          v-for="signal in signals"
          :key="signal.name"
          :data-ink="signal.ink"
          :style="{ '--paint': `var(--${signal.name})` }">
          <samp>{{ signal.name }}</samp>
          <p>
            <data :value="resolved[`--${signal.name}`]">
              {{ resolved[`--${signal.name}`] }}
            </data>
            <i>{{ signal.note }}</i>
          </p>
        </li>
      </ul>

      <h2>Neutrals</h2>
      <p>
        Earth names that pull double duty as the poster layer names in the data
        model — load-bearing well beyond the stylesheet.
      </p>
      <ul data-strip="neutrals">
        <li
          v-for="neutral in neutrals"
          :key="neutral.name"
          :data-ink="neutral.ink"
          :style="{ '--paint': `var(--${neutral.name})` }">
          <samp>{{ neutral.name }}</samp>
          <p>
            <data :value="resolved[`--${neutral.name}`]">
              {{ resolved[`--${neutral.name}`] }}
            </data>
          </p>
        </li>
      </ul>

      <h2>Surfaces</h2>
      <ul data-strip="surfaces">
        <li
          v-for="surface in surfaces"
          :key="surface.name"
          :data-ink="surface.ink"
          :style="{ '--paint': `var(--${surface.name})` }">
          <samp>{{ surface.name }}</samp>
          <p>
            <data :value="resolved[`--${surface.name}`]">
              {{ resolved[`--${surface.name}`] }}
            </data>
            <i v-if="surface.note">{{ surface.note }}</i>
          </p>
        </li>
      </ul>
    </article>
  </section>
</template>

<style lang="stylus">
  section#colors
    & > article
      max-width: page-width-large
      margin: 0 auto
      padding: base-line
      & > header > h1
        background: linear-gradient(60deg, var(--accent), var(--emphasis))
        background-clip: text
        -webkit-background-clip: text
        color: transparent
        width: fit-content
      & > header > p
      & > p
        max-width: page-width

    // roles
    & dl
      display: grid
      grid-template-columns: max-content 1fr
      gap: (base-line * 0.5) base-line
      align-items: baseline
      margin-bottom: base-line * 2
      & > dt::before
        content: ''
        display: inline-block
        width: base-line * 0.5
        height: base-line * 0.5
        border-radius: 50%
        background: var(--paint)
        margin-right: base-line * 0.35
      & > dd
        margin: 0
        display: flex
        align-items: baseline
        gap: base-line * 0.75
        flex-wrap: wrap
        & > p
          margin: 0
    & output[data-role]
      font-size: smaller
      padding: 0 (base-line * 0.4)
      border-radius: base-line
      border: 1px solid transparent
    & output[data-role='danger']
      color: danger
      border-color: danger
    & output[data-role='warning']
      border-color: warning
    & output[data-role='caution']
      border-color: caution
    & output[data-role='success']
      color: success
      border-color: success

    // swatches
    & figure
      margin: 0 0 (base-line * 1.5)
      & > figcaption
        display: flex
        align-items: baseline
        gap: base-line * 0.5
        margin-bottom: base-line * 0.4
        & > b
          text-transform: capitalize
        & > i
          font-style: normal
          opacity: 0.65
          font-size: smaller
      & > ul
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr))

    & figure > ul
    & ul[data-strip]
      list-style: none
      margin: 0 0 base-line
      padding: 0
      display: grid
      gap: base-line * 0.5
      & > li
        border: 1px solid var(--gravel)
        border-radius: base-line * 0.25
        overflow: hidden
        & > samp
          display: grid
          place-items: center
          height: base-line * 3
          background: var(--paint)
          color: white-text
        & > p
          margin: 0
          padding: (base-line * 0.25) (base-line * 0.4)
          font-size: smaller
          border-top: 1px solid var(--gravel)
          display: flex
          justify-content: space-between
          gap: base-line * 0.4
          flex-wrap: wrap
          & > small
            text-transform: uppercase
            letter-spacing: 0.08em
            opacity: 0.6
          & > data
            font-family: monospace
            font-size: smaller
          & > i
            font-style: normal
            opacity: 0.6
            font-size: smaller

    & ul[data-strip]
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr))

    & li[data-ground='chalk'] > samp
      background: chalk
      color: var(--paint)
    & li[data-ground='basalt'] > samp
      background: basalt
      color: var(--paint)
    & li[data-ink='dark'] > samp
      color: basalt
</style>
