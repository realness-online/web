<script setup>
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import css_var from '@/utils/css-var'
  import { format_css_paint } from '@/utils/colors'
  import { geology_layers } from '@/use/poster'
  import { VECTOR_LAYERS } from '@/3d/scenes/poster-scene-config'
  import icon from '@/components/icon'
  import preview_mark from '@/components/colors/preview-mark'
  import { icon_names } from '@/utils/icons'

  defineOptions({ name: 'Colors' })

  const icon_index = ref(0)
  const preview_icon = computed(() => icon_names[icon_index.value])
  const cycle_icon = () => {
    if (!icon_names.length) return
    icon_index.value = (icon_index.value + 1) % icon_names.length
  }

  const weights = ['fill', 'darken', 'lighten']
  const roles_weights_open = ref(false)
  const toggle_roles_weights_open = () => {
    roles_weights_open.value = !roles_weights_open.value
  }
  const role_names = ['accent', 'working', 'emphasis', 'warning']

  const variants = ['water', 'clay', 'slate']
  const signals = ['ochre']
  const surfaces = ['chalk', 'bone', 'pumice', 'basalt', 'moonlight']

  // variants carry an explicit "-fill" base token; signals and geology
  // layers use their bare name as the base — everything else shares
  // "-darken"/"-lighten" suffixes
  const base_token = name => (variants.includes(name) ? `${name}-fill` : name)

  /** @param {string} name @param {string} weight */
  const weighted_token = (name, weight) =>
    weight === 'fill' ? base_token(name) : `${name}-${weight}`

  const resolved = ref({})
  /** @type {import('vue').Ref<MediaQueryList | null>} */
  const scheme_query = ref(null)

  const resolve_paints = () => {
    const tokens = [...variants, ...signals, ...geology_layers].flatMap(name =>
      weights.map(weight => `--${weighted_token(name, weight)}`)
    )
    tokens.push(
      ...surfaces.map(name => `--${name}`),
      ...role_names.map(name => `--${name}`)
    )
    resolved.value = Object.fromEntries(
      tokens.map(token => [token, format_css_paint(css_var(token).trim())])
    )
  }

  onMounted(() => {
    resolve_paints()
    scheme_query.value = window.matchMedia('(prefers-color-scheme: dark)')
    scheme_query.value.addEventListener('change', resolve_paints)
  })

  onUnmounted(() => {
    scheme_query.value?.removeEventListener('change', resolve_paints)
  })

  const paint_names = computed(() => {
    /** @type {Record<string, { name: string, kind: string }>} */
    const names = {}
    for (const name of variants)
      for (const weight of weights) {
        const value = resolved.value[`--${weighted_token(name, weight)}`]?.hsla
        if (value && !names[value]) names[value] = { name, kind: 'variant' }
      }
    for (const name of signals)
      for (const weight of weights) {
        const value = resolved.value[`--${weighted_token(name, weight)}`]?.hsla
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
      return { role, variant: match?.name, kind: match?.kind, shared }
    })
  )

  const variant_of = role =>
    wiring.value.find(wire => wire.role === role)?.variant

  /** @param {string} role @param {string} weight */
  const role_weight_active = (role, weight) => {
    const name = variant_of(role)
    if (!name) return false
    return paint_of(role)?.hsla === paint_of(weighted_token(name, weight))?.hsla
  }

  /** @param {string | undefined} name @param {string} weight */
  const variant_weight_paint = (name, weight) =>
    name ? catalog_paint(weighted_token(name, weight)) : {}

  const roles_of = name =>
    wiring.value
      .filter(wire => wire.variant === name)
      .map(wire => `--${wire.role}`)
      .join(', ')

  const hue_of = name => {
    const paint =
      resolved.value[`--${name}-fill`] ?? resolved.value[`--${name}`]
    const hue = Number(paint?.h)
    return Number.isFinite(hue) ? Math.round(hue) : null
  }

  /** @param {string} token */
  const token_paint = token => ({ '--paint': `var(--${token})` })

  /** @param {string} token @param {'dark' | 'light' | undefined} [ink] */
  const catalog_paint = (token, ink) => {
    const style = token_paint(token)
    if (ink === 'dark') style['--ink'] = 'var(--basalt)'
    else if (ink === 'light') style['--ink'] = 'var(--bone)'
    else {
      const l = paint_of(token)?.l
      if (Number(l) >= 50) style['--ink'] = 'var(--basalt)'
    }
    return style
  }

  /** @param {string} role */
  const role_header_token = role => {
    if (role === 'warning') return 'ochre'
    const name = variant_of(role)
    return name ? `${name}-fill` : role
  }

  /** @param {string} role */
  const role_header_paint = role => {
    void resolved.value[`--${role}`] // re-run when paints resolve or scheme changes
    const token = role_header_token(role)
    if (role === 'warning' || role === 'working')
      return catalog_paint(token, 'dark')
    return catalog_paint(token)
  }

  /** @param {string} name */
  const stop_paint = name => ({
    '--paint': `var(--${name}-fill, var(--${name}))`
  })

  /** @param {string} name @param {string} surface */
  const surface_stop_paint = (name, surface) => {
    if (!paint_of(`${name}-darken`))
      return { '--paint': `var(--${name}-fill, var(--${name}))` }
    const light = Number(paint_of(surface)?.l) >= 50
    return { '--paint': `var(--${name}-${light ? 'darken' : 'lighten'})` }
  }

  /** @param {{ name: string, kind: string }} stop */
  const shelf_stop_paint = stop => ({
    ...stop_paint(stop.name),
    '--ink': stop.kind === 'signal' ? 'var(--basalt)' : 'var(--bone)'
  })

  /** @param {{ name: string, opacity: number }} layer */
  const geology_paint = layer => ({
    ...token_paint(layer.name),
    '--layer-opacity': layer.opacity
  })

  /** @param {{ name: string, opacity: number }} layer @param {string} surface */
  const surface_layer_paint = (layer, surface) => ({
    ...surface_stop_paint(layer.name, surface),
    '--layer-opacity': layer.opacity
  })

  /** @param {string} a @param {string} b */
  const role_bar_paint = (a, b) => ({
    '--a': `var(--${a})`,
    '--b': `var(--${b})`
  })

  /** @param {string} a @param {string} b */
  const variant_bar_paint = (a, b) => ({
    '--a': `var(--${a}-fill)`,
    '--b': `var(--${b}-fill)`
  })

  const geology = computed(() =>
    geology_layers.map(name => ({
      name,
      opacity: VECTOR_LAYERS.find(layer => layer.name === name)?.opacity ?? 1
    }))
  )

  const paint_stops = computed(() =>
    [
      ...variants.map(name => ({ name, kind: 'variant' })),
      ...signals.map(name => ({ name, kind: 'signal' }))
    ]
      .map(stop => ({ ...stop, hue: hue_of(stop.name) }))
      .sort((a, b) => {
        if (a.hue === null && b.hue === null) return 0
        if (a.hue === null) return 1
        if (b.hue === null) return -1
        return a.hue - b.hue
      })
  )

  /** @type {import('vue').Ref<{ a: string, b: string } | null>} */
  const preview = ref(null)

  /** @param {string} token */
  const paint_of = token => resolved.value[`--${token}`]

  const variant_combos = computed(() => {
    const default_pair = new Set([variant_of('accent'), variant_of('emphasis')])
    const pairs = []
    for (let i = 0; i < variants.length; i++)
      for (let j = i + 1; j < variants.length; j++) {
        const a = variants[i]
        const b = variants[j]
        if (
          default_pair.size === 2 &&
          default_pair.has(a) &&
          default_pair.has(b)
        )
          continue
        pairs.push({ a, b })
      }
    return pairs
  })

  const bar_button_style = computed(() =>
    preview.value
      ? variant_bar_paint(preview.value.a, preview.value.b)
      : role_bar_paint('accent', 'emphasis')
  )

  const bar_label = computed(() =>
    preview.value
      ? { a: preview.value.a, b: preview.value.b }
      : { a: variant_of('accent'), b: variant_of('emphasis') }
  )

  const shelf = computed(() =>
    [
      ...variants.map(name => ({ name, kind: 'variant' })),
      ...signals.map(name => ({ name, kind: 'signal' }))
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
  <section
    id="colors"
    class="page"
    itemid="/colors"
    itemscope
    itemtype="/colors">
    <header>
      <h1>Color</h1>
    </header>

    <article itemscope itemprop="roles">
      <header>
        <h2>Roles</h2>
      </header>
      <ul>
        <li itemscope itemprop="accent">
          <p
            itemscope
            itemprop="lighten"
            v-show="roles_weights_open"
            :style="variant_weight_paint(variant_of('accent'), 'lighten')"
            :aria-current="
              role_weight_active('accent', 'lighten') ? 'true' : undefined
            ">
            <samp>lighten</samp>
          </p>
          <header
            :style="role_header_paint('accent')"
            role="button"
            tabindex="0"
            :aria-expanded="roles_weights_open"
            @click="toggle_roles_weights_open"
            @keydown.enter="toggle_roles_weights_open"
            @keydown.space.prevent="toggle_roles_weights_open">
            <span>
              <code>--accent</code>
              <samp itemprop="variant">{{ variant_of('accent') }}</samp>
            </span>
            <data
              itemprop="hsla"
              :value="paint_of(role_header_token('accent'))?.hsla"></data>
            <icon name="arrow" aria-hidden="true" />
          </header>
          <p
            itemscope
            itemprop="darken"
            v-show="roles_weights_open"
            :style="variant_weight_paint(variant_of('accent'), 'darken')"
            :aria-current="
              role_weight_active('accent', 'darken') ? 'true' : undefined
            ">
            <samp>darken</samp>
          </p>
          <figure>
            <figcaption>links, primary actions, saved fields</figcaption>
            <a href="/docs">Documentation</a>
            <button type="button">Post</button>
          </figure>
        </li>

        <li itemscope itemprop="working">
          <p
            itemscope
            itemprop="lighten"
            v-show="roles_weights_open"
            :style="variant_weight_paint(variant_of('working'), 'lighten')"
            :aria-current="
              role_weight_active('working', 'lighten') ? 'true' : undefined
            ">
            <samp>lighten</samp>
          </p>
          <header
            :style="role_header_paint('working')"
            role="button"
            tabindex="0"
            :aria-expanded="roles_weights_open"
            @click="toggle_roles_weights_open"
            @keydown.enter="toggle_roles_weights_open"
            @keydown.space.prevent="toggle_roles_weights_open">
            <span>
              <code>--working</code>
              <samp itemprop="variant">{{ variant_of('working') }}</samp>
            </span>
            <data
              itemprop="hsla"
              :value="paint_of(role_header_token('working'))?.hsla"></data>
            <icon name="arrow" aria-hidden="true" />
          </header>
          <p
            itemscope
            itemprop="darken"
            v-show="roles_weights_open"
            :style="variant_weight_paint(variant_of('working'), 'darken')"
            :aria-current="
              role_weight_active('working', 'darken') ? 'true' : undefined
            ">
            <samp>darken</samp>
          </p>
          <figure>
            <figcaption>saving, in progress</figcaption>
            <output>saving</output>
            <input type="text" class="in-progress" value="Scott" />
          </figure>
        </li>

        <li itemscope itemprop="emphasis">
          <p
            itemscope
            itemprop="lighten"
            v-show="roles_weights_open"
            :style="variant_weight_paint(variant_of('emphasis'), 'lighten')"
            :aria-current="
              role_weight_active('emphasis', 'lighten') ? 'true' : undefined
            ">
            <samp>lighten</samp>
          </p>
          <header
            :style="role_header_paint('emphasis')"
            role="button"
            tabindex="0"
            :aria-expanded="roles_weights_open"
            @click="toggle_roles_weights_open"
            @keydown.enter="toggle_roles_weights_open"
            @keydown.space.prevent="toggle_roles_weights_open">
            <span>
              <code>--emphasis</code>
              <samp itemprop="variant">{{ variant_of('emphasis') }}</samp>
            </span>
            <data
              itemprop="hsla"
              :value="paint_of(role_header_token('emphasis'))?.hsla"></data>
            <icon name="arrow" aria-hidden="true" />
          </header>
          <p
            itemscope
            itemprop="darken"
            v-show="roles_weights_open"
            :style="variant_weight_paint(variant_of('emphasis'), 'darken')"
            :aria-current="
              role_weight_active('emphasis', 'darken') ? 'true' : undefined
            ">
            <samp>darken</samp>
          </p>
          <figure>
            <figcaption>selected controls, form errors, remove</figcaption>
            <label>
              <input type="checkbox" checked />
              mosaic
            </label>
            <p>Name required</p>
            <button type="button" aria-label="Remove">
              <icon name="remove" />
            </button>
          </figure>
        </li>

        <li itemscope itemprop="warning">
          <p
            itemscope
            itemprop="lighten"
            v-show="roles_weights_open"
            :style="variant_weight_paint(variant_of('warning'), 'lighten')"
            :aria-current="
              role_weight_active('warning', 'lighten') ? 'true' : undefined
            ">
            <samp>lighten</samp>
          </p>
          <header
            :style="role_header_paint('warning')"
            role="button"
            tabindex="0"
            :aria-expanded="roles_weights_open"
            @click="toggle_roles_weights_open"
            @keydown.enter="toggle_roles_weights_open"
            @keydown.space.prevent="toggle_roles_weights_open">
            <span>
              <code>--warning</code>
              <samp itemprop="variant">{{ variant_of('warning') }}</samp>
            </span>
            <data
              itemprop="hsla"
              :value="paint_of(role_header_token('warning'))?.hsla"></data>
            <icon name="arrow" aria-hidden="true" />
          </header>
          <p
            itemscope
            itemprop="darken"
            v-show="roles_weights_open"
            :style="variant_weight_paint(variant_of('warning'), 'darken')"
            :aria-current="
              role_weight_active('warning', 'darken') ? 'true' : undefined
            ">
            <samp>darken</samp>
          </p>
          <figure>
            <figcaption>offline, low fps</figcaption>
            <output>offline</output>
          </figure>
        </li>
      </ul>
    </article>

    <article itemscope itemprop="palette">
      <header>
        <h2>Palette</h2>
      </header>
      <details>
        <summary :style="bar_button_style">
          <span aria-hidden="true"></span>
          <p>
            <span itemscope itemprop="accent">
              <b itemprop="variant">{{ bar_label.a }}</b>
              <code v-if="!preview" itemprop="role">--accent</code>
            </span>
            <span itemscope itemprop="emphasis">
              <b itemprop="variant">{{ bar_label.b }}</b>
              <code v-if="!preview" itemprop="role">--emphasis</code>
            </span>
          </p>
        </summary>
        <figure>
          <figcaption>
            Every variant paired with every other — click one to preview it
            above
          </figcaption>
          <ul>
            <li>
              <button
                type="button"
                :aria-pressed="!preview ? 'true' : 'false'"
                :style="role_bar_paint('accent', 'emphasis')"
                @click="preview = null">
                <span aria-hidden="true"></span>
                <p>
                  <samp>{{ variant_of('accent') }}</samp> ·
                  <samp>{{ variant_of('emphasis') }}</samp>
                </p>
              </button>
            </li>
            <li v-for="combo in variant_combos" :key="`${combo.a}-${combo.b}`">
              <button
                type="button"
                :aria-pressed="
                  preview?.a === combo.a && preview?.b === combo.b
                    ? 'true'
                    : 'false'
                "
                :style="variant_bar_paint(combo.a, combo.b)"
                @click="preview = { a: combo.a, b: combo.b }">
                <span aria-hidden="true"></span>
                <p>
                  <samp>{{ combo.a }}</samp> · <samp>{{ combo.b }}</samp>
                </p>
              </button>
            </li>
          </ul>
        </figure>
      </details>

      <figure>
        <ul>
          <li
            v-for="stop in shelf"
            :key="stop.name"
            itemscope
            :itemprop="stop.name"
            :style="shelf_stop_paint(stop)">
            <samp>{{ stop.name }}</samp>
            <p>
              <meta v-if="stop.roles" itemprop="roles" :content="stop.roles" />
              <meta
                v-if="stop.hue !== null"
                itemprop="hue"
                :content="stop.hue" />
            </p>
          </li>
        </ul>
      </figure>
    </article>

    <article itemscope itemprop="variants">
      <header>
        <h2>Variants</h2>
      </header>
      <figure v-for="name in variants" :key="name" itemscope :itemprop="name">
        <figcaption>
          <samp>{{ name }}</samp>
          <i v-if="name === 'water'" itemprop="note">the cool</i>
          <i v-else-if="name === 'clay'" itemprop="note">warmth</i>
          <i v-else-if="name === 'slate'" itemprop="note">
            quiet blue · <code>--working</code> uses darken/lighten
          </i>
          <meta
            v-if="hue_of(name) !== null"
            itemprop="hue"
            :content="hue_of(name) ?? ''" />
        </figcaption>
        <ul>
          <li
            v-for="weight in weights"
            :key="weight"
            itemscope
            :itemprop="weight"
            :style="catalog_paint(`${name}-${weight}`)">
            <preview_mark
              :name="preview_icon"
              :label="`${name} ${weight}`"
              @cycle="cycle_icon" />
          </li>
        </ul>
      </figure>
    </article>

    <article itemscope itemprop="signals">
      <header>
        <h2>Signals</h2>
      </header>
      <ul>
        <li itemscope itemprop="ochre" :style="catalog_paint('ochre', 'dark')">
          <samp>ochre</samp>
          <p>
            <data itemprop="oklch" :value="paint_of('ochre')?.oklch">
              {{ paint_of('ochre')?.oklch }}
            </data>
            <meta
              v-if="roles_of('ochre')"
              itemprop="roles"
              :content="roles_of('ochre')" />
            <i itemprop="note">offline, low fps</i>
          </p>
        </li>
        <li
          itemscope
          itemprop="working"
          :style="catalog_paint('slate-fill', 'dark')">
          <samp>slate</samp>
          <p>
            <data itemprop="oklch" :value="paint_of('slate-fill')?.oklch">
              {{ paint_of('slate-fill')?.oklch }}
            </data>
            <meta
              v-if="roles_of('slate')"
              itemprop="roles"
              :content="roles_of('slate')" />
            <i itemprop="note">saving, in progress</i>
          </p>
        </li>
      </ul>
    </article>

    <article itemscope itemprop="surfaces">
      <header>
        <h2>Surfaces</h2>
      </header>

      <figure>
        <ol>
          <li
            v-for="surface in surfaces"
            :key="surface"
            itemscope
            :itemprop="surface">
            <samp>{{ surface }}</samp>
            <ul>
              <li
                v-for="stop in paint_stops"
                :key="stop.name"
                itemscope
                :itemprop="stop.name"
                :style="surface_stop_paint(stop.name, surface)">
                <preview_mark
                  :name="preview_icon"
                  :label="`${surface} ${stop.name}`"
                  @cycle="cycle_icon" />
              </li>
            </ul>
          </li>
        </ol>
      </figure>
    </article>
    <article itemscope itemprop="depth">
      <header>
        <h2>Depth</h2>
      </header>
      <figure>
        <ol>
          <li itemscope itemprop="chalk">
            <figure>
              <aside aria-hidden="true"></aside>
              <section>
                <article itemscope itemprop="bone">
                  <p><a href="/docs">accent</a> on <samp>bone</samp></p>
                  <figure aria-hidden="true"></figure>
                </article>
              </section>
              <figcaption><samp>chalk</samp> <code>--surface</code></figcaption>
            </figure>
          </li>
          <li itemscope itemprop="basalt">
            <figure>
              <aside aria-hidden="true"></aside>
              <section>
                <article itemscope itemprop="pumice">
                  <p><a href="/docs">accent</a> on <samp>pumice</samp></p>
                  <figure aria-hidden="true"></figure>
                </article>
              </section>
              <figcaption>
                <samp>basalt</samp> <code>--surface</code>
              </figcaption>
            </figure>
          </li>
        </ol>
      </figure>
    </article>

    <details itemscope itemprop="geology">
      <summary>
        <icon name="arrow" aria-hidden="true" />
        <h2>Geology</h2>
      </summary>
      <figure
        v-for="layer in geology"
        :key="layer.name"
        itemscope
        :itemprop="layer.name">
        <figcaption>
          <samp>{{ layer.name }}</samp>
          <meta
            v-if="hue_of(layer.name) !== null"
            itemprop="hue"
            :content="hue_of(layer.name) ?? ''" />
        </figcaption>
        <ul>
          <li
            v-for="weight in weights"
            :key="weight"
            itemscope
            :itemprop="weight"
            :style="catalog_paint(weighted_token(layer.name, weight))">
            <preview_mark
              :name="preview_icon"
              :label="`${layer.name} ${weight}`"
              @cycle="cycle_icon" />
          </li>
        </ul>
      </figure>

      <figure>
        <ol>
          <li
            v-for="layer in geology"
            :key="layer.name"
            itemscope
            :itemprop="layer.name"
            :style="geology_paint(layer)">
            <samp>{{ layer.name }}</samp>
            <ul>
              <li
                v-for="stop in paint_stops"
                :key="stop.name"
                itemscope
                :itemprop="stop.name"
                :style="stop_paint(stop.name)">
                <preview_mark
                  :name="preview_icon"
                  :label="`${layer.name} ${stop.name}`"
                  @cycle="cycle_icon" />
              </li>
            </ul>
          </li>
        </ol>
        <figcaption>
          Click any mark to cycle through <code>icons.svg</code>.
        </figcaption>
      </figure>

      <figure>
        <ol>
          <li
            v-for="surface in surfaces"
            :key="surface"
            itemscope
            :itemprop="surface">
            <samp>{{ surface }}</samp>
            <ul>
              <li
                v-for="layer in geology"
                :key="layer.name"
                itemscope
                :itemprop="layer.name"
                :style="surface_layer_paint(layer, surface)">
                <preview_mark
                  :name="preview_icon"
                  :label="`${surface} ${layer.name}`"
                  @cycle="cycle_icon" />
              </li>
            </ul>
          </li>
        </ol>
      </figure>
    </details>
  </section>
</template>

<style lang="stylus">
  colors-icon-cell() {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: base-line * 0.15;
    padding: base-line;
    border-radius: base-line * 0.2;
    border: 1px solid unquote('color-mix(in srgb, var(--text) 14%, transparent)');
  }

  colors-weight-swatch-row() {
    gap: base-line * 0.75;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    & > li {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: base-line * 0.25;
      min-height: base-line * 3;
      padding: base-line;
      border-radius: base-line * 0.25;
      border: none;
      box-shadow: inset 0 0 0 1px unquote('color-mix(in srgb, var(--text) 14%, transparent)');
      &[itemprop='fill'] {
        background: var(--paint);
        color: var(--ink, var(--bone));
      }
      &[itemprop='darken'] {
        background: var(--chalk);
        color: var(--paint);
      }
      &[itemprop='lighten'] {
        background: var(--basalt);
        color: var(--paint);
      }
    }
  }

  colors-layer-grid-figure() {
    margin-bottom: base-line * 2;
    & > ol {
      list-style: none;
      display: grid;
      gap: base-line * 0.5;
      & > li {
        border-radius: base-line * 0.25;
        padding: base-line;
        background: var(--paint);
        opacity: var(--layer-opacity, 1);
        & > samp {
          display: block;
          margin-bottom: base-line;
          text-transform: capitalize;
          font-size: smaller;
          color: var(--ink, var(--bone));
          text-shadow: 0 0 base-line rgba(0, 0, 0, 0.35);
        }
        & > ul {
          list-style: none;
          margin: 0;
          standard-grid($mode: auto-fit, $min: base-line * 3.38, $min-large: base-line * 3.38, $gap: base-line * 0.35);
          & > li {
            colors-icon-cell();
            color: var(--paint);
          }
        }
      }
    }
    & > figcaption {
      margin-top: base-line;
      font-size: smaller;
      opacity: 0.75;
    }
  }

  section#colors {
    code {
      font-size: smaller;
    }
    & > header {
      max-width: page-width-max;
      margin: 0 auto;
      padding: base-line base-line base-line;
      & > h1 {
        background: linear-gradient(60deg, var(--accent), var(--emphasis));
        background-clip: text;
        color: transparent;
        width: fit-content;
      }
    }
    & > article,
    & > details {
      max-width: page-width-max;
      margin: 0 auto;
      padding: 0 base-line base-line;
      & > header > h2 {
        margin-top: 0;
      }
      & > summary {
        display: flex;
        align-items: center;
        gap: base-line * 0.4;
        list-style: none;
        margin-bottom: base-line;
        &::-webkit-details-marker {
          display: none;
        }
        & > h2 {
          margin: 0;
        }
      }
      & > header > p {
        max-width: page-width;
        font-size: smaller;
        opacity: 0.75;
      }
      & > footer > p {
        max-width: page-width;
        margin: (base-line * 2) 0 0;
        font-size: smaller;
        opacity: 0.75;
      }
      & figure {
        margin-bottom: base-line * 2;
        & > figcaption {
          display: flex;
          align-items: baseline;
          gap: base-line * 0.5;
          margin-bottom: base-line;
          & > b,
          & > samp {
            text-transform: capitalize;
          }
          & > samp {
            font-family: monospace;
          }
          & > i {
            font-style: normal;
            opacity: 0.65;
            font-size: smaller;
          }
        }
        & > ul {
          grid-template-columns: repeat(auto-fit, minmax((base-line * 7.5), 1fr));
        }
      }
      & > figure > ul,
      & > ul {
        list-style: none;
        margin: 0 0 (base-line * 2);
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
            color: var(--ink, var(--bone));
          }
          & > p {
            margin: 0;
            padding: base-line (base-line * 0.4);
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

      &[itemprop='palette'] {
        details {
          margin: 0 0 (base-line * 2);
          & > summary {
            display: block;
            cursor: pointer;
            list-style: none;
            &::-webkit-details-marker {
              display: none;
            }
            &::marker {
              display: none;
            }
            & > span[aria-hidden='true'] {
              display: block;
              width: 100%;
              height: base-line * 1.5;
              border-radius: base-line * 0.25;
              background: linear-gradient(90deg, var(--a), var(--b));
              transition: transform 0.15s ease;
            }
            &:hover > span[aria-hidden='true'] {
              transform: scaleY(1.15);
            }
            & > p {
              display: flex;
              justify-content: space-between;
              margin: base-line 0 0;
              font-size: smaller;
              & > span {
                display: flex;
                align-items: baseline;
                gap: base-line * 0.25;
              }
            }
          }
          & > figure {
            margin: base-line 0 0;
            & > figcaption {
              margin-bottom: base-line;
              font-size: smaller;
              opacity: 0.75;
            }
            & > ul {
              list-style: none;
              margin: 0;
              standard-grid($mode: auto-fit, $min: base-line * 6.75, $min-large: base-line * 6.75, $gap: base-line * 0.5);
              & > li > button {
                display: block;
                width: 100%;
                padding: 0;
                border: 1px solid transparent;
                border-radius: base-line * 0.25;
                background: none;
                cursor: pointer;
                &[aria-pressed='true'] {
                  border-color: var(--text);
                }
                & > span[aria-hidden='true'] {
                  display: block;
                  width: 100%;
                  height: base-line;
                  border-radius: base-line * 0.2;
                  background: linear-gradient(90deg, var(--a), var(--b));
                }
                & > p {
                  margin: base-line 0 0;
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
        }
        & > figure {
          margin: 0 0 (base-line * 2);
          & > figcaption {
            margin-bottom: base-line;
            font-size: smaller;
            opacity: 0.75;
          }
          & > ul {
            list-style: none;
            margin: 0;
            standard-grid($mode: auto-fit, $min: base-line * 4.5, $min-large: base-line * 4.5, $gap: base-line * 0.5);
            & > li {
              border: 1px solid var(--gravel);
              border-radius: base-line * 0.25;
              overflow: hidden;
              &[itemprop='ochre'] {
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
                padding: base-line (base-line * 0.35);
                font-size: smaller;
                display: flex;
                flex-direction: column;
                gap: base-line * 0.1;
                border-top: 1px solid var(--gravel);
                & > data {
                  opacity: 0.55;
                }
              }
            }
          }
        }
      }

      &[itemprop='depth'] {
        margin: 0 0 (base-line * 2);
        & > figure {
          padding: base-line;
          background: var(--moonlight);
          border-radius: base-line * 0.35;
        }
        & figure > ol {
          list-style: none;
          standard-grid($mode: auto-fit, $min: base-line * 10.5, $min-large: base-line * 10.5);
          & > li {
            display: grid;
            gap: base-line * 0.35;
            & > figure {
              position: relative;
              min-height: base-line * 10;
              padding: base-line;
              border-radius: base-line * 0.25;
              border: 1px solid var(--gravel);
              overflow: hidden;
              & > figcaption {
                margin: base-line 0 0;
                font-size: smaller;
                opacity: 0.75;
                & > samp {
                  text-transform: capitalize;
                }
              }
            }
          }
          & > li[itemprop='chalk'] {
            --accent: var(--water-darken);
            --emphasis: var(--clay-fill);
            --surface-glass: var(--chalk-transparent);
          }
          & > li[itemprop='basalt'] {
            --accent: var(--water-lighten);
            --emphasis: var(--clay-lighten);
            --surface-glass: var(--basalt-transparent);
          }
        }
        & aside[aria-hidden='true'] {
          position: absolute;
          inset: 0;
          background: var(--moonlight);
        }
        & section {
          position: relative;
          padding: base-line;
          border-radius: base-line * 0.25;
          min-height: base-line * 7;
        }
        & li[itemprop='chalk'] section {
          background: var(--chalk);
          color: var(--graphite);
        }
        & li[itemprop='basalt'] section {
          background: var(--basalt);
          color: var(--bone);
        }
        & article[itemprop='bone'],
        & article[itemprop='pumice'] {
          padding: base-line;
          border-radius: base-line * 0.25;
          background: var(--bone);
          color: var(--graphite);
          & > figure[aria-hidden='true'] {
            height: base-line * 0.75;
            border-radius: base-line * 0.2;
            background: linear-gradient(90deg, var(--accent), var(--emphasis));
          }
          & a {
            color: var(--accent);
          }
        }
        & li[itemprop='basalt'] article[itemprop='pumice'] {
          background: var(--pumice);
          color: var(--bone);
        }
      }

      &[itemprop='geology'] {
        & > summary > svg.arrow {
          width: base-line * 0.55;
          height: base-line * 0.55;
          flex-shrink: 0;
          transition: transform 0.15s ease;
        }
        &[open] > summary > svg.arrow {
          transform: rotate(90deg);
        }
        & > figure[itemscope] > ul {
          colors-weight-swatch-row();
        }
        & > figure:not([itemscope]) {
          colors-layer-grid-figure();
        }
        & > figure:last-of-type > ol > li > ul > li {
          opacity: var(--layer-opacity, 1);
        }
        & li[itemprop='chalk'] {
          --paint: var(--chalk);
          --ink: var(--basalt);
        }
        & li[itemprop='bone'] {
          --paint: var(--bone);
          --ink: var(--basalt);
        }
        & li[itemprop='pumice'] {
          --paint: var(--pumice);
        }
        & li[itemprop='basalt'] {
          --paint: var(--basalt);
        }
        & li[itemprop='moonlight'] {
          --paint: var(--moonlight);
        }
      }

      &[itemprop='surfaces'] {
        & > figure {
          colors-layer-grid-figure();
        }
        & > figure:last-of-type > ol > li > ul > li {
          opacity: var(--layer-opacity, 1);
        }
        & li[itemprop='chalk'] {
          --paint: var(--chalk);
          --ink: var(--basalt);
        }
        & li[itemprop='bone'] {
          --paint: var(--bone);
          --ink: var(--basalt);
        }
        & li[itemprop='pumice'] {
          --paint: var(--pumice);
        }
        & li[itemprop='basalt'] {
          --paint: var(--basalt);
        }
        & li[itemprop='moonlight'] {
          --paint: var(--moonlight);
        }
      }

      &[itemprop='roles'] {
        & > ul {
          list-style: none;
          margin: 0;
          display: grid;
          gap: base-line;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          & > li {
            display: grid;
            grid-template-rows: auto auto auto 1fr;
            gap: base-line * 0.35;
            border: 1px solid var(--gravel);
            border-radius: base-line * 0.25;
            overflow: hidden;
            &[itemprop='accent'] {
              --role: var(--accent);
            }
            &[itemprop='working'] {
              --role: var(--working);
            }
            &[itemprop='emphasis'] {
              --role: var(--emphasis);
            }
            &[itemprop='warning'] {
              --role: var(--warning);
            }
            & > p[itemprop='lighten'] {
              grid-row: 1;
            }
            & > header {
              grid-row: 2;
              display: flex;
              align-items: baseline;
              justify-content: space-between;
              gap: base-line * 0.35;
              padding: base-line (base-line * 0.5);
              background: var(--paint);
              color: var(--ink, var(--bone));
              cursor: pointer;
              focus-ring(-2px);
              & > span {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: base-line * 0.35;
                & > samp {
                  font-family: monospace;
                  opacity: 0.75;
                }
              }
              & > data {
                font-family: monospace;
                font-size: smaller;
                opacity: 0.75;
              }
              & > svg.arrow {
                width: base-line * 0.5;
                height: base-line * 0.5;
                flex-shrink: 0;
                transition: transform 0.15s ease;
              }
              &[aria-expanded='true'] > svg.arrow {
                transform: rotate(90deg);
              }
            }
            & > p[itemprop='darken'] {
              grid-row: 3;
            }
            & > p[itemprop='lighten'],
            & > p[itemprop='darken'] {
              margin: 0;
              padding: base-line (base-line * 0.5);
              text-align: center;
              font-size: smaller;
              background: var(--paint);
              color: var(--ink, var(--bone));
              border: 2px solid transparent;
              &[aria-current='true'] {
                border-color: var(--text);
              }
              & > samp {
                font-size: smaller;
              }
            }
            & > figure:last-of-type {
              grid-row: 4;
              padding: base-line;
              border-top: 1px solid var(--gravel);
              background: var(--surface);
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: flex-start;
              gap: base-line * 0.5;
              min-height: base-line * 3.5;
              & > figcaption {
                flex: 1 1 100%;
                margin: 0 0 base-line;
                font-size: smaller;
                opacity: 0.65;
              }
              & > a {
                color: var(--role);
                min-width: 0;
              }
              & > button {
                flex: 0 0 auto;
                min-width: max-content;
                width: max-content;
                padding: base-line (base-line * 0.5);
                border: 1px solid var(--role);
                border-radius: base-line * 0.25;
                background: transparent;
                color: var(--role);
                font: inherit;
                cursor: default;
              }
              & > label {
                display: flex;
                align-items: center;
                gap: base-line * 0.35;
                font-size: smaller;
                accent-color: var(--role);
              }
              & > p {
                margin: 0;
                padding-left: base-line * 0.35;
                border-left: 2px solid var(--role);
                font-size: smaller;
                color: var(--role);
              }
              & > input[type='text'] {
                padding: base-line (base-line * 0.35);
                border: 1px solid var(--gravel);
                border-radius: base-line * 0.2;
                background: var(--surface);
                color: var(--text);
                font: inherit;
                font-size: smaller;
                &[aria-invalid='true'],
                &.in-progress {
                  border-color: var(--role);
                }
              }
              & > output {
                font-size: smaller;
                padding: base-line (base-line * 0.4);
                border-radius: base-line;
                border: 1px solid var(--role);
                color: var(--role);
              }
            }
            &[itemprop='emphasis'] > figure:last-of-type > button {
              padding: 0;
              border: none;
              background: none;
              color: inherit;
              line-height: 1;
              & > svg {
                display: block;
                width: base-line;
                height: base-line;
                fill: var(--role);
              }
            }
            &[itemprop='warning'] > figure:last-of-type > output,
            &[itemprop='working'] > figure:last-of-type > output {
              border-color: transparent;
              background: var(--role);
              color: var(--basalt);
            }
          }
        }
      }

      &[itemprop='variants'] {
        figure[itemscope] > ul {
          colors-weight-swatch-row();
        }
      }

      &[itemprop='signals'] {
        & > ul {
          grid-template-columns: repeat(auto-fit, minmax((base-line * 6.75), 1fr));
        }
      }
    }
  }
</style>
