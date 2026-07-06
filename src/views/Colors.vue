<script setup>
  import { ref, computed, onMounted as mounted } from 'vue'
  import css_var from '@/utils/css-var'
  import { format_css_paint } from '@/utils/colors'
  import { geology_layers } from '@/use/poster'
  import { VECTOR_LAYERS } from '@/3d/scenes/poster-scene-config'
  import icon from '@/components/icon'

  defineOptions({ name: 'Colors' })

  const icon_names = [
    'realness',
    'add',
    'animation',
    'arrow',
    'camera',
    'circle',
    'collapse',
    'color',
    'date-picker',
    'download',
    'edit',
    'expand',
    'finished',
    'galaxy',
    'gear',
    'grid',
    'hamburger',
    'heart',
    'home',
    'location',
    'message',
    'opacity',
    'picker',
    'play',
    'remove',
    'search',
    'share',
    'silhouette',
    'star',
    'starburst',
    'write'
  ]
  const icon_index = ref(0)
  const preview_icon = computed(() => icon_names[icon_index.value])
  const cycle_icon = () =>
    (icon_index.value = (icon_index.value + 1) % icon_names.length)

  const variants = ['light', 'dark', 'fill']
  const role_names = [
    'accent',
    'emphasis',
    'danger',
    'warning',
    'caution',
    'success'
  ]

  const materials = [
    { name: 'water', note: 'the cool primary; was blue' },
    { name: 'clay', note: 'the warm half; was red' },
    { name: 'moss', note: 'in stock for success states' },
    { name: 'slate', note: 'a quieter companion to water' },
    { name: 'heather', note: 'the one flower on the hillside' }
  ]
  const signals = [
    { name: 'sulfur', note: 'offline, the fps floor', ink: 'dark' },
    { name: 'ochre', note: 'working states, mask pen', ink: 'dark' }
  ]
  const surfaces = [
    { name: 'chalk', note: 'light --surface', ink: 'dark' },
    { name: 'bone', note: 'light poster', ink: 'dark' },
    { name: 'graphite', note: 'light --text', ink: 'dark' },
    { name: 'pumice', note: 'dark poster' },
    { name: 'basalt', note: 'dark --surface' },
    { name: 'moonlight', note: 'depth behind everything' }
  ]

  const resolved = ref({})

  mounted(() => {
    const tokens = materials.flatMap(({ name }) =>
      variants.map(variant => `--${name}-${variant}`)
    )
    tokens.push(
      ...[
        ...signals.map(({ name }) => name),
        ...surfaces.map(({ name }) => name),
        ...geology_layers
      ].map(name => `--${name}`),
      ...role_names.map(name => `--${name}`)
    )
    resolved.value = Object.fromEntries(
      tokens.map(token => [token, format_css_paint(css_var(token).trim())])
    )
  })

  const paint_names = computed(() => {
    /** @type {Record<string, { name: string, kind: string }>} */
    const names = {}
    for (const { name } of materials)
      for (const variant of variants) {
        const value = resolved.value[`--${name}-${variant}`]?.hsla
        if (value && !names[value]) names[value] = { name, kind: 'material' }
      }
    for (const { name } of signals) {
      const value = resolved.value[`--${name}`]?.hsla
      if (value && !names[value]) names[value] = { name, kind: 'signal' }
    }
    return names
  })

  const wiring = computed(() =>
    role_names.map((role, index) => {
      const value = resolved.value[`--${role}`]?.hsla
      const match = value ? paint_names.value[value] : null
      const shared = value
        ? role_names
            .slice(0, index)
            .find(other => resolved.value[`--${other}`]?.hsla === value)
        : null
      return { role, material: match?.name, kind: match?.kind, shared }
    })
  )

  const material_of = role =>
    wiring.value.find(wire => wire.role === role)?.material

  const roles_of = name =>
    wiring.value
      .filter(wire => wire.material === name)
      .map(wire => `--${wire.role}`)
      .join(', ')

  const hue_of = name => {
    const paint =
      resolved.value[`--${name}-fill`] ?? resolved.value[`--${name}`]
    const hue = Number(paint?.h)
    return Number.isFinite(hue) ? Math.round(hue) : null
  }

  const geology = computed(() =>
    geology_layers.map(name => ({
      name,
      opacity: VECTOR_LAYERS.find(layer => layer.name === name)?.opacity ?? 1
    }))
  )

  const paint_stops = computed(() =>
    [
      ...materials.map(({ name }) => ({ name, kind: 'material' })),
      ...signals.map(({ name }) => ({ name, kind: 'signal' }))
    ]
      .map(stop => ({ ...stop, hue: hue_of(stop.name) }))
      .sort((a, b) => {
        if (a.hue === null && b.hue === null) return 0
        if (a.hue === null) return 1
        if (b.hue === null) return -1
        return a.hue - b.hue
      })
  )

  const combos_open = ref(false)
  const preview = ref(null)

  const material_combos = computed(() => {
    const pairs = []
    for (let i = 0; i < materials.length; i++)
      for (let j = i + 1; j < materials.length; j++)
        pairs.push({ a: materials[i].name, b: materials[j].name })
    return pairs
  })

  const bar_paint = computed(() =>
    preview.value
      ? {
          a: `var(--${preview.value.a}-fill)`,
          b: `var(--${preview.value.b}-fill)`
        }
      : { a: 'var(--accent)', b: 'var(--emphasis)' }
  )

  const bar_label = computed(() =>
    preview.value
      ? { a: preview.value.a, b: preview.value.b }
      : { a: material_of('accent'), b: material_of('emphasis') }
  )

  const shelf = computed(() =>
    [
      ...materials.map(({ name }) => ({ name, kind: 'material' })),
      ...signals.map(({ name }) => ({ name, kind: 'signal' }))
    ]
      .map(stop => ({
        ...stop,
        hue: hue_of(stop.name),
        roles: roles_of(stop.name)
      }))
      .sort((a, b) => {
        if (a.hue === null && b.hue === null) return 0
        if (a.hue === null) return 1
        if (b.hue === null) return -1
        return a.hue - b.hue
      })
  )
</script>

<template>
  <section id="colors" class="page">
    <article>
      <header>
        <h1>Color</h1>
      </header>

      <figure class="accent-pair">
        <button
          type="button"
          :style="{ '--a': bar_paint.a, '--b': bar_paint.b }"
          :aria-expanded="combos_open"
          aria-label="Show all material color combos"
          @click="combos_open = !combos_open"></button>
        <figcaption>
          <span>
            <b>{{ bar_label.a }}</b>
            <code v-if="!preview">--accent</code>
          </span>
          <span>
            <b>{{ bar_label.b }}</b>
            <code v-if="!preview">--emphasis</code>
          </span>
        </figcaption>
      </figure>

      <figure v-if="combos_open" class="combos">
        <figcaption>
          Every material paired with every other — click one to preview it up
          top
        </figcaption>
        <ul>
          <li>
            <button
              type="button"
              class="default"
              :class="{ active: !preview }"
              :style="{ '--a': 'var(--accent)', '--b': 'var(--emphasis)' }"
              @click="preview = null">
              <div aria-hidden="true"></div>
              <p>
                <samp>{{ material_of('accent') }}</samp> ·
                <samp>{{ material_of('emphasis') }}</samp>
              </p>
            </button>
          </li>
          <li v-for="combo in material_combos" :key="`${combo.a}-${combo.b}`">
            <button
              type="button"
              :class="{
                active: preview?.a === combo.a && preview?.b === combo.b
              }"
              :style="{
                '--a': `var(--${combo.a}-fill)`,
                '--b': `var(--${combo.b}-fill)`
              }"
              @click="preview = { a: combo.a, b: combo.b }">
              <div aria-hidden="true"></div>
              <p>
                <samp>{{ combo.a }}</samp> · <samp>{{ combo.b }}</samp>
              </p>
            </button>
          </li>
        </ul>
      </figure>

      <figure class="shelf">
        <figcaption>Paint on the shelf — hue order, actual values</figcaption>
        <ul
          :style="{ 'grid-template-columns': `repeat(${shelf.length}, 1fr)` }">
          <li
            v-for="stop in shelf"
            :key="stop.name"
            :class="stop.kind"
            :style="{
              '--paint': `var(--${stop.name}-fill, var(--${stop.name}))`,
              '--ink':
                stop.kind === 'signal' ? 'var(--basalt)' : 'var(--white-text)'
            }">
            <samp>{{ stop.name }}</samp>
            <p>
              <i v-if="stop.roles"
                ><code>{{ stop.roles }}</code></i
              >
              <small v-if="stop.hue !== null">hue {{ stop.hue }}</small>
            </p>
          </li>
        </ul>
      </figure>

      <h2>Depth</h2>
      <figure class="scene">
        <div class="schemes">
          <div class="scheme light">
            <div class="stack">
              <div class="moonlight" aria-hidden="true"></div>
              <div class="surface">
                <article class="poster">
                  <p>
                    <a href="/docs">accent</a> on
                    <samp>bone</samp>
                  </p>
                  <div class="accent-pair" aria-hidden="true"></div>
                </article>
              </div>
            </div>
            <p class="scheme-label">
              <samp>chalk</samp> <code>--surface</code>
            </p>
          </div>
          <div class="scheme dark">
            <div class="stack">
              <div class="moonlight" aria-hidden="true"></div>
              <div class="surface">
                <article class="poster">
                  <p>
                    <a href="/docs">accent</a> on
                    <samp>pumice</samp>
                  </p>
                  <div class="accent-pair" aria-hidden="true"></div>
                </article>
                <output class="signal warning">offline</output>
                <output class="signal caution">saving</output>
              </div>
            </div>
            <p class="scheme-label">
              <samp>basalt</samp> <code>--surface</code>
            </p>
          </div>
        </div>
        <figcaption class="scene-note">
          <samp>moonlight</samp> behind both — poster on <samp>bone</samp> in
          light, <samp>pumice</samp> in dark, signals interrupt on top of either
        </figcaption>
      </figure>

      <h2>Geology</h2>
      <figure class="strata">
        <ol>
          <li
            v-for="layer in geology"
            :key="layer.name"
            :style="{
              '--paint': `var(--${layer.name})`,
              '--layer-opacity': layer.opacity
            }">
            <samp>{{ layer.name }}</samp>
            <data :value="resolved[`--${layer.name}`]?.hsla">
              {{ resolved[`--${layer.name}`]?.hsla }}
            </data>
          </li>
        </ol>
        <figcaption>
          Mosaic cutouts stack like cels — same five names in posters, prefs,
          and export
        </figcaption>
      </figure>

      <figure class="strata-swatches">
        <ol>
          <li
            v-for="layer in geology"
            :key="layer.name"
            :style="{
              '--paint': `var(--${layer.name})`,
              '--layer-opacity': layer.opacity
            }">
            <samp>{{ layer.name }}</samp>
            <ul>
              <li
                v-for="stop in paint_stops"
                :key="stop.name"
                :style="{
                  '--paint': `var(--${stop.name}-fill, var(--${stop.name}))`
                }">
                <button
                  type="button"
                  class="icon-preview"
                  :aria-label="`Preview icon: ${preview_icon}, click to cycle`"
                  @click="cycle_icon">
                  <icon :name="preview_icon" />
                </button>
                <small>{{ stop.name }}</small>
              </li>
            </ul>
          </li>
        </ol>
        <figcaption>
          Palette over strata — every material and signal laid on each
          sediment-through-boulders ground, to eyeball legibility before it
          ships. Click any mark to cycle through <code>icons.svg</code>.
        </figcaption>
      </figure>

      <h2>Materials</h2>
      <figure v-for="material in materials" :key="material.name" itemscope>
        <figcaption>
          <b itemprop="name">{{ material.name }}</b>
          <i>
            <template v-if="hue_of(material.name) !== null">
              hue {{ hue_of(material.name) }} —
            </template>
            {{ material.note }}
          </i>
        </figcaption>
        <ul>
          <li
            v-for="variant in variants"
            :key="variant"
            :style="{ '--paint': `var(--${material.name}-${variant})` }">
            <samp>Aa</samp>
            <p>
              <small>{{ variant }}</small>
              <data :value="resolved[`--${material.name}-${variant}`]?.hsla">
                {{ resolved[`--${material.name}-${variant}`]?.hsla }}
                <small>{{
                  resolved[`--${material.name}-${variant}`]?.oklch
                }}</small>
              </data>
            </p>
          </li>
        </ul>
      </figure>

      <menu>
        <button type="button" class="water">.water</button>
        <input class="graphite" placeholder=".graphite" />
      </menu>

      <h2>Signals</h2>
      <ul class="catalog-strip">
        <li
          v-for="signal in signals"
          :key="signal.name"
          :style="{
            '--paint': `var(--${signal.name})`,
            '--ink': signal.ink === 'dark' ? 'var(--basalt)' : null
          }">
          <samp>{{ signal.name }}</samp>
          <p>
            <data :value="resolved[`--${signal.name}`]?.hsla">
              {{ resolved[`--${signal.name}`]?.hsla }}
              <small>{{ resolved[`--${signal.name}`]?.oklch }}</small>
            </data>
            <i>
              <template v-if="roles_of(signal.name)">
                <code>{{ roles_of(signal.name) }}</code> —
              </template>
              {{ signal.note }}
            </i>
          </p>
        </li>
      </ul>

      <h2>Surfaces</h2>
      <ul class="catalog-strip">
        <li
          v-for="surface in surfaces"
          :key="surface.name"
          :style="{
            '--paint': `var(--${surface.name})`,
            '--ink': surface.ink === 'dark' ? 'var(--basalt)' : null
          }">
          <samp>{{ surface.name }}</samp>
          <p>
            <data :value="resolved[`--${surface.name}`]?.hsla">
              {{ resolved[`--${surface.name}`]?.hsla }}
              <small>{{ resolved[`--${surface.name}`]?.oklch }}</small>
            </data>
            <i v-if="surface.note">{{ surface.note }}</i>
          </p>
        </li>
      </ul>

      <figure class="strata-swatches surface-swatches">
        <ol>
          <li
            v-for="surface in surfaces"
            :key="surface.name"
            :style="{
              '--paint': `var(--${surface.name})`,
              '--ink': surface.ink === 'dark' ? 'var(--basalt)' : null
            }">
            <samp>{{ surface.name }}</samp>
            <ul>
              <li
                v-for="stop in paint_stops"
                :key="stop.name"
                :style="{
                  '--paint': `var(--${stop.name}-fill, var(--${stop.name}))`
                }">
                <button
                  type="button"
                  class="icon-preview"
                  :aria-label="`Preview icon: ${preview_icon}, click to cycle`"
                  @click="cycle_icon">
                  <icon :name="preview_icon" />
                </button>
                <small>{{ stop.name }}</small>
              </li>
            </ul>
          </li>
        </ol>
        <figcaption>
          Palette over surfaces — every material and signal laid on each
          chalk-through-graphite ground, to eyeball legibility before it ships.
          Click any mark to cycle through <code>icons.svg</code>.
        </figcaption>
      </figure>

      <h2>Roles</h2>
      <dl>
        <template v-for="wire in wiring" :key="wire.role">
          <dt :style="{ '--paint': `var(--${wire.role})` }">
            <code>--{{ wire.role }}</code>
          </dt>
          <dd>
            <p>
              <b>{{ wire.material }}</b>
              <template v-if="wire.shared">
                · same paint as <code>--{{ wire.shared }}</code>
              </template>
              <template v-else-if="wire.kind === 'signal'"> · signal </template>
            </p>
            <a v-if="wire.role === 'accent'" href="/docs">link</a>
            <label v-else-if="wire.role === 'emphasis'">
              <input type="checkbox" checked /> selected
            </label>
            <output
              v-else-if="wire.role === 'danger'"
              style="--paint: var(--danger); --ink: var(--danger)">
              remove
            </output>
            <output
              v-else-if="wire.role === 'warning'"
              style="--paint: var(--warning)">
              offline
            </output>
            <output
              v-else-if="wire.role === 'caution'"
              style="--paint: var(--caution)">
              saving
            </output>
            <output
              v-else-if="wire.role === 'success'"
              style="--paint: var(--success); --ink: var(--success)">
              in stock
            </output>
          </dd>
        </template>
      </dl>

      <footer>
        <p>
          Earth names carry the geology — sediment through boulders are poster
          layers, prefs, and export. Materials are paint on the shelf; roles are
          the jobs. A rebrand rewires <code>color.styl</code>, not every call
          site.
        </p>
      </footer>
    </article>
  </section>
</template>

<style lang="stylus">
  @require '../style/color'

  section#colors {
    & > article {
      max-width: base-line * 48;
      margin: 0 auto;
      padding: base-line;
      & > header > h1 {
        background: linear-gradient(60deg, var(--accent), var(--emphasis));
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        width: fit-content;
        margin-bottom: base-line;
      }
      & > footer > p {
        max-width: page-width;
        margin: (base-line * 2) 0 0;
        font-size: smaller;
        opacity: 0.75;
      }
    }

    & figure.accent-pair {
      margin: 0 0 base-line;
      & > button {
        display: block;
        width: 100%;
        height: base-line * 1.5;
        padding: 0;
        border: none;
        border-radius: base-line * 0.25;
        background: linear-gradient(90deg, var(--a), var(--b));
        cursor: pointer;
        transition: transform 0.15s ease;
        &:hover {
          transform: scaleY(1.15);
        }
      }
      & > figcaption {
        display: flex;
        justify-content: space-between;
        margin-top: base-line * 0.35;
        font-size: smaller;
        & > span {
          display: flex;
          align-items: baseline;
          gap: base-line * 0.25;
        }
      }
    }

    & figure.combos {
      margin: 0 0 (base-line * 2);
      & > figcaption {
        margin-bottom: base-line * 0.4;
        font-size: smaller;
        opacity: 0.75;
      }
      & > ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: base-line * 0.5;
        & > li > button {
          display: block;
          width: 100%;
          padding: 0;
          border: 1px solid transparent;
          border-radius: base-line * 0.25;
          background: none;
          cursor: pointer;
          &.active {
            border-color: var(--text);
          }
          & > div {
            height: base-line;
            border-radius: base-line * 0.2;
            background: linear-gradient(90deg, var(--a), var(--b));
          }
          & > p {
            margin: (base-line * 0.25) 0 0;
            font-size: smaller;
            text-align: center;
            color: var(--text);
            & > samp {
              text-transform: capitalize;
            }
          }
        }
      }
    }

    & figure.scene {
      margin: 0 0 (base-line * 2);
      & > .schemes {
        display: grid;
        gap: base-line;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      }
      & .scheme {
        display: grid;
        gap: base-line * 0.35;
        & > .scheme-label {
          margin: 0;
          font-size: smaller;
          opacity: 0.75;
          & > samp {
            text-transform: capitalize;
          }
        }
      }
      & .stack {
        position: relative;
        min-height: base-line * 10;
        padding: base-line;
        border-radius: base-line * 0.25;
        border: 1px solid var(--gravel);
        overflow: hidden;
      }
      & .moonlight {
        position: absolute;
        inset: 0;
        background: var(--moonlight);
      }
      & .surface {
        position: relative;
        padding: base-line;
        border-radius: base-line * 0.25;
        min-height: base-line * 7;
      }
      & .scheme.light {
        light-accent-tokens();
      }
      & .scheme.dark {
        dark-accent-tokens();
      }
      & .scheme.light .surface {
        background: var(--chalk);
        color: var(--graphite);
      }
      & .scheme.dark .surface {
        background: var(--basalt);
        color: var(--white-text);
        & > p {
          margin: 0 0 (base-line * 0.5);
        }
        & > .accent-pair {
          height: base-line * 0.75;
          border-radius: base-line * 0.2;
          background: linear-gradient(90deg, var(--accent), var(--emphasis));
        }
        & > a,
        & > p > a {
          color: var(--accent);
        }
      }
      & .poster {
        margin: 0;
        padding: base-line;
        border-radius: base-line * 0.25;
        background: var(--bone);
        color: var(--graphite);
        & > p {
          margin: 0 0 (base-line * 0.5);
        }
        & > .accent-pair {
          height: base-line * 0.75;
          border-radius: base-line * 0.2;
          background: linear-gradient(90deg, var(--accent), var(--emphasis));
        }
        & a {
          color: var(--accent);
        }
      }
      & .scheme.dark .poster {
        background: var(--pumice);
        color: var(--white-text);
        & > .accent-pair {
          background: linear-gradient(90deg, var(--accent), var(--emphasis));
        }
        & a {
          color: var(--accent);
        }
      }
      & .signal {
        position: absolute;
        font-size: smaller;
        padding: (base-line * 0.15) (base-line * 0.4);
        border-radius: base-line;
        border: 1px solid transparent;
        &.warning {
          top: base-line * 0.5;
          right: base-line * 0.5;
          background: var(--warning);
          color: var(--basalt);
        }
        &.caution {
          bottom: base-line * 0.5;
          right: base-line * 0.5;
          background: var(--caution);
          color: var(--basalt);
        }
      }
      & > figcaption.scene-note {
        margin-top: base-line * 0.4;
        font-size: smaller;
        opacity: 0.75;
        & > samp {
          text-transform: capitalize;
        }
      }
    }

    & figure.strata {
      margin: 0 0 (base-line * 2);
      & > ol {
        list-style: none;
        margin: 0;
        padding: 0;
        border-radius: base-line * 0.25;
        border: 1px solid var(--gravel);
        overflow: hidden;
        & > li {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: base-line * 0.5;
          height: base-line * 1.75;
          padding: 0 (base-line * 0.5);
          background: var(--paint);
          opacity: var(--layer-opacity);
          &:not(:first-child) {
            margin-top: -(base-line * 0.4);
            box-shadow: 0 -(base-line * 0.1) (base-line * 0.25) rgba(0, 0, 0, 0.2);
          }
          & > samp {
            text-transform: capitalize;
            font-size: smaller;
            color: var(--white-text);
            text-shadow: 0 0 base-line rgba(0, 0, 0, 0.35);
          }
          & > data {
            font-family: monospace;
            font-size: smaller;
            color: var(--white-text);
            text-shadow: 0 0 base-line rgba(0, 0, 0, 0.35);
          }
        }
      }
      & > figcaption {
        margin-top: base-line * 0.4;
        font-size: smaller;
        opacity: 0.75;
      }
    }

    & figure.strata-swatches {
      margin: 0 0 (base-line * 2);
      & > ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: base-line * 0.5;
        & > li {
          border-radius: base-line * 0.25;
          padding: base-line * 0.5;
          background: var(--paint);
          opacity: var(--layer-opacity, 1);
          & > samp {
            display: block;
            margin-bottom: base-line * 0.35;
            text-transform: capitalize;
            font-size: smaller;
            color: var(--ink, var(--white-text));
            text-shadow: 0 0 base-line rgba(0, 0, 0, 0.35);
          }
          & > ul {
            list-style: none;
            margin: 0;
            padding: 0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(4.5rem, 1fr));
            gap: base-line * 0.35;
            & > li {
              display: grid;
              justify-items: center;
              gap: base-line * 0.15;
              padding: base-line * 0.35;
              border-radius: base-line * 0.2;
              border: 1px solid alpha(black, 0.18);
              & > button.icon-preview {
                display: block;
                padding: 0;
                border: none;
                background: none;
                color: var(--paint);
                cursor: pointer;
                & > svg.icon {
                  width: base-line * 1.5;
                  height: base-line * 1.5;
                }
              }
              & > small {
                text-transform: capitalize;
                opacity: 0.85;
                color: var(--ink, var(--white-text));
              }
            }
          }
        }
      }
      & > figcaption {
        margin-top: base-line * 0.4;
        font-size: smaller;
        opacity: 0.75;
      }
    }

    & figure.shelf {
      margin: 0 0 (base-line * 2);
      & > figcaption {
        margin-bottom: base-line * 0.4;
        font-size: smaller;
        opacity: 0.75;
      }
      & > ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
        gap: base-line * 0.5;
        & > li {
          border: 1px solid var(--gravel);
          border-radius: base-line * 0.25;
          overflow: hidden;
          &.signal {
            border-style: dashed;
          }
          & > samp {
            display: grid;
            place-items: center;
            height: base-line * 2.5;
            background: var(--paint);
            color: var(--ink);
            text-transform: capitalize;
            font-size: smaller;
          }
          & > p {
            margin: 0;
            padding: (base-line * 0.2) (base-line * 0.35);
            font-size: smaller;
            display: flex;
            flex-direction: column;
            gap: base-line * 0.1;
            border-top: 1px solid var(--gravel);
            & > i {
              font-style: normal;
              opacity: 0.75;
            }
            & > small {
              opacity: 0.55;
            }
          }
        }
      }
    }

    & dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: (base-line * 0.5) base-line;
      align-items: baseline;
      margin-bottom: base-line;
      & > dt::before {
        content: '';
        display: inline-block;
        width: base-line * 0.5;
        height: base-line * 0.5;
        border-radius: 50%;
        background: var(--paint);
        margin-right: base-line * 0.35;
      }
      & > dd {
        margin: 0;
        display: flex;
        align-items: baseline;
        gap: base-line * 0.75;
        flex-wrap: wrap;
        & > p {
          margin: 0;
        }
      }
    }
    & dd > output {
      font-size: smaller;
      padding: 0 (base-line * 0.4);
      border-radius: base-line;
      border: 1px solid var(--paint, transparent);
      color: var(--ink, inherit);
    }

    & menu {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: base-line;
      margin: 0 0 (base-line * 2);
      padding: 0;
      & > input {
        padding: base-line * 0.4;
      }
    }

    & figure {
      margin: 0 0 (base-line * 1.5);
      & > figcaption {
        display: flex;
        align-items: baseline;
        gap: base-line * 0.5;
        margin-bottom: base-line * 0.4;
        & > b {
          text-transform: capitalize;
        }
        & > i {
          font-style: normal;
          opacity: 0.65;
          font-size: smaller;
        }
      }
      & > ul {
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      }
    }

    & ul.catalog-strip,
    & figure > ul {
      list-style: none;
      margin: 0 0 (base-line * 2);
      padding: 0;
      display: grid;
      gap: base-line * 0.5;
      & > li {
        border: 1px solid var(--gravel);
        border-radius: base-line * 0.25;
        overflow: hidden;
        & > samp {
          display: grid;
          place-items: center;
          height: base-line * 3;
          background: var(--paint);
          color: var(--ink, var(--white-text));
        }
        & > p {
          margin: 0;
          padding: (base-line * 0.25) (base-line * 0.4);
          font-size: smaller;
          border-top: 1px solid var(--gravel);
          display: flex;
          justify-content: space-between;
          gap: base-line * 0.4;
          flex-wrap: wrap;
          & > small {
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.6;
          }
          & > data {
            font-family: monospace;
            font-size: smaller;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: base-line * 0.1;
            text-align: right;
            & > small {
              opacity: 0.55;
              text-transform: none;
              letter-spacing: normal;
            }
          }
          & > i {
            font-style: normal;
            opacity: 0.6;
            font-size: smaller;
          }
        }
      }
    }

    & ul.catalog-strip {
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    }

    & figure[itemscope] > ul > li:nth-child(1) > samp {
      background: var(--chalk);
      color: var(--paint);
    }
    & figure[itemscope] > ul > li:nth-child(2) > samp {
      background: var(--basalt);
      color: var(--paint);
    }
  }
</style>
