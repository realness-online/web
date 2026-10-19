<script setup>
  import { KEY_LAYERS, keyboard_layers } from '@/utils/keys-overview'
  import { computed, onMounted, onUnmounted, ref } from 'vue'

  const props = defineProps({
    groups: { type: Array, required: true }
  })

  /** Width in key units for caps wider than one key; the two Shifts differ. */
  const WIDTH = {
    escape: 1.5,
    backspace: 1.5,
    tab: 1.5,
    '\\': 1.5,
    capslock: 1.8,
    enter: 2.2,
    shift: 2.4,
    right_shift: 2.6,
    cmd: 1.3,
    space: 5.4
  }

  /** [cap, label, size key when it differs from the cap] */
  const ROWS = [
    [
      ['escape', 'esc'],
      ['`', '`'],
      ['1', '1'],
      ['2', '2'],
      ['3', '3'],
      ['4', '4'],
      ['5', '5'],
      ['6', '6'],
      ['7', '7'],
      ['8', '8'],
      ['9', '9'],
      ['0', '0'],
      ['-', '-'],
      ['=', '='],
      ['backspace', 'delete']
    ],
    [
      ['tab', 'tab'],
      ...'qwertyuiop'.split('').map(c => [c, c]),
      ['[', '['],
      [']', ']'],
      ['\\', '\\']
    ],
    [
      ['capslock', 'caps'],
      ...'asdfghjkl'.split('').map(c => [c, c]),
      [';', ';'],
      ["'", "'"],
      ['enter', 'return']
    ],
    [
      ['shift', 'shift'],
      ...'zxcvbnm'.split('').map(c => [c, c]),
      [',', ','],
      ['.', '.'],
      ['/', '/'],
      ['shift', 'shift', 'right_shift']
    ],
    [
      ['fn', 'fn'],
      ['control', 'ctrl'],
      ['option', 'opt'],
      ['cmd', 'cmd'],
      ['space', ''],
      ['cmd', 'cmd'],
      ['option', 'opt'],
      ['arrowleft', '←'],
      ['arrowup', '↑'],
      ['arrowright', '→']
    ]
  ]

  const LAYER_LABEL = {
    plain: 'No modifier',
    shift: 'Shift',
    option: 'Option',
    cmd: 'Cmd / Ctrl'
  }

  const layers = computed(() => keyboard_layers(props.groups))
  const chosen = ref('plain')
  const pressed = ref('')
  const layer = computed(() => pressed.value || chosen.value)

  /** Cmd and Ctrl share a layer; with several held, the strongest wins. */
  const layer_for = event => {
    if (event.metaKey || event.ctrlKey) return 'cmd'
    if (event.altKey) return 'option'
    if (event.shiftKey) return 'shift'
    return ''
  }
  const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta'])
  const track = event => {
    if (event.type === 'keydown' && !MODIFIERS.has(event.key)) return
    pressed.value = layer_for(event)
    selected.value = ''
  }
  const release = () => (pressed.value = '')
  onMounted(() => {
    window.addEventListener('keydown', track)
    window.addEventListener('keyup', track)
    window.addEventListener('blur', release)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', track)
    window.removeEventListener('keyup', track)
    window.removeEventListener('blur', release)
  })
  const selected = ref('')

  const caps = computed(() => layers.value[layer.value])
  const count = name => Object.keys(layers.value[name]).length

  /** The modifier caps light up for the layer being shown. */
  const held = cap =>
    (layer.value === 'shift' && cap === 'shift') ||
    (layer.value === 'option' && cap === 'option') ||
    (layer.value === 'cmd' && (cap === 'cmd' || cap === 'control'))

  /** `pref::Toggle_Mosaic` → Mosaic; listener rows use their description. */
  const short = entry => {
    if (!entry.command)
      return entry.description
        .replace(/^Show (the )?/, '')
        .split(' ')
        .slice(0, 3)
        .join(' ')
    return entry.command
      .split('::')[1]
      .replace(/^(Toggle|Cycle|Go|Open|Show)_/, '')
      .replace(/_/g, ' ')
  }

  const owner = cap => {
    const entries = caps.value[cap]
    if (!entries?.length) return undefined
    const groups = new Set(entries.map(e => e.group))
    return groups.size > 1 ? 'collision' : entries[0].group
  }

  const detail = computed(() =>
    selected.value ? (caps.value[selected.value] ?? []) : []
  )

  const legend = computed(() =>
    props.groups
      .filter(g => g.entries.some(e => e.key && e.key !== 'Any'))
      .map(g => ({ id: g.id, title: g.title }))
  )

  const pick_layer = name => {
    chosen.value = name
    selected.value = ''
  }
</script>

<template>
  <figure itemscope itemtype="https://schema.org/ImageObject" data-keyboard>
    <nav aria-label="Modifier layer">
      <button
        v-for="name in KEY_LAYERS"
        :key="name"
        type="button"
        :aria-pressed="layer === name"
        @click="pick_layer(name)">
        {{ LAYER_LABEL[name] }} <small>{{ count(name) }}</small>
      </button>
    </nav>

    <div role="group" :aria-label="`${LAYER_LABEL[layer]} layer`">
      <div v-for="(row, r) in ROWS" :key="r" data-row>
        <button
          v-for="([cap, label, size], c) in row"
          :key="`${r}-${c}`"
          type="button"
          :style="{ '--width': WIDTH[size ?? cap] ?? 1 }"
          :data-owner="owner(cap)"
          :data-held="held(cap) || undefined"
          :data-shadowed="caps[cap]?.every(e => !e.reachable) || undefined"
          :aria-pressed="selected === cap"
          :disabled="!caps[cap]"
          @click="selected = selected === cap ? '' : cap"
          @mouseenter="caps[cap] && (selected = cap)">
          <span data-cap>{{ label }}</span>
          <small v-if="caps[cap]">
            {{
              caps[cap].length > 1
                ? `${caps[cap].length} claims`
                : short(caps[cap][0])
            }}
          </small>
        </button>
      </div>
    </div>

    <figcaption>
      <ul data-legend>
        <li v-for="group in legend" :key="group.id" :data-owner="group.id">
          {{ group.title }}
        </li>
        <li data-owner="collision">Claimed by more than one group</li>
      </ul>

      <dl v-if="detail.length" aria-live="polite">
        <template v-for="(entry, i) in detail" :key="i">
          <dt :data-owner="entry.group">{{ entry.title }}</dt>
          <dd>
            {{ entry.description }}
            <small v-if="entry.command">{{ entry.command }}</small>
            <small v-if="!entry.reachable"
              >Never fires: modifiers are blocked.</small
            >
            <small v-if="entry.note">{{ entry.note }}</small>
          </dd>
        </template>
      </dl>
      <p v-else>Point at a key, or hold Shift, Ctrl, Option, or Cmd.</p>
    </figcaption>
  </figure>
</template>

<style lang="stylus">
  figure[data-keyboard] {
    margin: 0 0 base-line * 3;

    [data-owner='appearance'] { --owner: var(--sediment); }
    [data-owner='view'] { --owner: var(--water-fill); }
    [data-owner='home'] { --owner: var(--clay-fill); }
    [data-owner='chat'] { --owner: var(--slate-fill); }
    [data-owner='navigation'] { --owner: var(--boulders-lighten); }
    [data-owner='unbound'] { --owner: var(--pumice); }
    [data-owner='terminal'] { --owner: var(--gravel); }
    [data-owner='collision'] { --owner: var(--warning); }

    & > nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: base-line * 0.25;
      margin-bottom: base-line;

      button {
        padding: base-line * 0.25 base-line * 0.6;
        border: calc(var(--base-line) * 0.1) solid var(--accent);
        border-radius: base-line * 0.25;
        background: transparent;
        color: var(--text);
        cursor: pointer;

        &[aria-pressed='true'] {
          background: var(--emphasis);
          border-color: var(--emphasis);
          color: var(--contrast);
        }
      }
    }

    [role='group'] {
      display: flex;
      flex-direction: column;
      gap: 0.4%;
      padding: 1.2%;
      border-radius: base-line * 0.5;
      background: var(--code-surface);
      container-type: inline-size;
    }

    [data-row] {
      display: flex;
      gap: 0.4%;

      button {
        flex: var(--width) 1 0;
        min-width: 0;
        aspect-ratio: calc(var(--width) * 1) / 1;
        max-height: 7cqi;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 0.5cqi 0.6cqi;
        border: 0.15cqi solid unquote('color-mix(in srgb, var(--text) 18%, transparent)');
        border-radius: 0.8cqi;
        background: var(--surface);
        color: var(--text);
        text-align: left;
        overflow: hidden;
        cursor: pointer;

        [data-cap] {
          font-size: 1.6cqi;
          line-height: 1;
        }

        small {
          font-size: 1.05cqi;
          line-height: 1.1;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        &:disabled {
          cursor: default;
          color: var(--muted-text);
          opacity: 0.55;
        }

        &[data-owner] {
          background: unquote('color-mix(in srgb, var(--owner) 35%, var(--surface))');
          border-color: var(--owner);
        }

        &[data-owner='collision'] {
          background: repeating-linear-gradient(-45deg, unquote('color-mix(in srgb, var(--warning) 45%, var(--surface))') 0 0.6cqi, var(--surface) 0.6cqi 1.2cqi);
          border-width: 0.3cqi;
        }

        &[data-held] {
          opacity: 1;
          background: var(--emphasis);
          color: var(--contrast);
        }

        &[data-shadowed] {
          background: transparent;
          border-style: dashed;

          [data-cap] { text-decoration: line-through; }
        }

        &[aria-pressed='true'] {
          outline: 0.3cqi solid var(--emphasis);
          outline-offset: 0.2cqi;
        }
      }
    }

    figcaption {
      margin-top: base-line;

      ul[data-legend] {
        display: flex;
        flex-wrap: wrap;
        gap: base-line * 0.25 base-line;
        list-style: none;
        padding: 0;
        margin: 0 0 base-line;
        font-size: smaller;

        li[data-owner="collision"]::before {
          background: repeating-linear-gradient(-45deg, var(--warning) 0 2px, transparent 2px 4px);
          outline: round(base-line * 0.1, 2) solid var(--warning);
        }

        li::before {
          content: '';
          display: inline-block;
          width: base-line * 0.6;
          height: base-line * 0.6;
          margin-right: base-line * 0.25;
          vertical-align: middle;
          border-radius: base-line * 0.15;
          background: var(--owner);
        }
      }

      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: base-line * 0.25 base-line;
        margin: 0;
        min-height: base-line * 3;

        dt {
          font-weight: bold;
          border-left: calc(var(--base-line) * 0.16) solid var(--owner);
          padding-left: base-line * 0.5;
        }

        dd {
          margin: 0;

          small {
            display: block;
            color: var(--accent);
          }
        }
      }

      & > p {
        min-height: base-line * 3;
        color: var(--muted-text);
        margin: 0;
      }
    }
  }
</style>
