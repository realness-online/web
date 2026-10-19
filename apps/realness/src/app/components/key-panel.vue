<script setup>
  import {
    computed,
    inject,
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref
  } from 'vue'
  import * as preferences from '@/utils/preference'
  import { preference_command } from '@/utils/keymaps'

  const key_commands = inject('key-commands')

  const ROWS = ['`1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm,./']
  /** Shifted symbols sit on the cap that types them unshifted. */
  const SHIFTED = { '?': '/' }
  const LAYERS = new Set(
    [
      'Bold',
      'Medium',
      'Regular',
      'Light',
      'Background',
      'Boulders',
      'Rocks',
      'Gravel',
      'Sand',
      'Sediment'
    ].map(name => `pref::Toggle_${name}`)
  )

  /** Command → the preference it switches, for the on/off fill. */
  const preference_of = Object.fromEntries(
    Object.entries(preference_command).map(([name, command]) => [
      command,
      preferences[name]
    ])
  )

  /** Names that fit a key; the rest come from the command itself. */
  const SHORT = {
    'view::Toggle_Chat': 'Chat',
    'view::Layout_Thoughts': 'Thoughts',
    'view::Layout_Chat_Thoughts': 'Chat + thoughts',
    'view::Layout_Chat': 'Chat only',
    'view::Layout_Chat_Tui': 'Chat + terminal',
    'view::Layout_Tui': 'Terminal',
    'pref::Toggle_View_3d': '3D',
    'pref::Toggle_Storytelling': 'Story',
    'pref::Cycle_Aspect_Ratio': 'Aspect',
    'pref::Cycle_Animation_Speed': 'Speed',
    'pref::Cycle_Drama': 'Lights',
    'ui::Toggle_Presentation': 'Present',
    'ui::Show_Documentation': 'Docs',
    'ui::Clear_Sync_Time': 'Clear sync'
  }

  /** `pref::Toggle_Mosaic` → Mosaic */
  const label = command =>
    SHORT[command] ??
    command
      .split('::')[1]
      .replace(/^(Toggle|Cycle|Go|Open|Show)_/, '')
      .replace(/_/g, ' ')

  /** Held Shift brightens the lower labels: they are what a key runs now. */
  const shift = ref(false)
  const track_shift = event => {
    if (event.key === 'Shift') shift.value = event.type === 'keydown'
  }
  const release = () => (shift.value = false)
  on_mounted(() => {
    window.addEventListener('keydown', track_shift)
    window.addEventListener('keyup', track_shift)
    window.addEventListener('blur', release)
  })
  on_unmounted(() => {
    window.removeEventListener('keydown', track_shift)
    window.removeEventListener('keyup', track_shift)
    window.removeEventListener('blur', release)
  })

  const group = command => {
    if (LAYERS.has(command)) return 'layers'
    if (command.startsWith('pref::')) return 'poster'
    if (command.startsWith('view::')) return 'views'
    return 'app'
  }

  const caps = computed(() => {
    const by_cap = {}
    for (const binding of key_commands.get_available_commands.value) {
      if (!binding.leader) continue
      const { key } = binding
      const shifted = Boolean(SHIFTED[key]) || key !== key.toLowerCase()
      const cap = SHIFTED[key] ?? key.toLowerCase()
      by_cap[cap] ??= {}
      by_cap[cap][shifted ? 'shift' : 'plain'] = binding.command
    }
    return by_cap
  })

  /** A cap's own command, or its Shift one when that is all it has. */
  const main = cap => cap.plain ?? cap.shift

  const pressed = command => {
    const preference = preference_of[command]
    return preference ? String(Boolean(preference.value)) : undefined
  }

  const run = command => {
    key_commands.panel_open.value = false
    key_commands.run_command(command)
  }
</script>

<template>
  <dialog
    v-if="key_commands.panel_open.value"
    open
    aria-label="Keys"
    :data-shift="shift || undefined"
    data-key-panel>
    <ol>
      <li v-for="row in ROWS" :key="row">
        <ol>
          <li v-for="cap in row" :key="cap">
            <button
              type="button"
              tabindex="-1"
              :value="cap"
              :disabled="!caps[cap] || undefined"
              :data-group="caps[cap] ? group(main(caps[cap])) : undefined"
              :aria-pressed="caps[cap] ? pressed(main(caps[cap])) : undefined"
              @pointerdown.prevent
              @click="run(main(caps[cap]))">
              <kbd>{{ cap }}</kbd>
              <span>{{ caps[cap]?.plain ? label(caps[cap].plain) : '' }}</span>
              <small>{{
                caps[cap]?.shift ? label(caps[cap].shift) : ''
              }}</small>
            </button>
          </li>
        </ol>
      </li>
    </ol>
  </dialog>
</template>

<style lang="stylus">
  dialog[data-key-panel] {
    position: fixed;
    inset: auto 0 base-line;
    margin-inline: auto;
    z-index: 12;
    padding: base-line;
    border: 1px solid var(--muted-text);
    border-radius: (base-line / 2);
    background: var(--surface);
    box-shadow: 0 0 base-line var(--surface);
    color: var(--text);
    --key: unquote('clamp(2.5rem, 6vw, 4.25rem)');
    & ol {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    & > ol {
      display: grid;
      gap: (base-line / 4);
      & > li:nth-child(2) {
        padding-inline-start: calc(var(--key) / 2);
      }
      & > li:nth-child(3) {
        padding-inline-start: calc(var(--key) * 0.75);
      }
      & > li:nth-child(4) {
        padding-inline-start: calc(var(--key) * 1.25);
      }
      & ol {
        display: flex;
        gap: (base-line / 4);
      }
    }
    [data-group='layers'] {
      --group: var(--sediment);
    }
    [data-group='poster'] {
      --group: var(--clay-lighten);
    }
    [data-group='views'] {
      --group: var(--water-lighten);
    }
    [data-group='app'] {
      --group: var(--slate-lighten);
    }
    & button {
      inline-size: var(--key);
      block-size: var(--key);
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: 0.2rem 0.3rem;
      text-align: start;
      font-size: unquote('clamp(0.5rem, 0.35rem + 0.4vw, 0.75rem)');
      line-height: 1.15;
      hyphens: auto;
      color: var(--text);
      background: transparent;
      border: 1.5px solid var(--group, var(--muted-text));
      border-radius: 0.3rem;
      cursor: pointer;
      &[disabled] {
        opacity: 0.25;
        cursor: default;
      }
      &[aria-pressed='true'] {
        background: unquote('color-mix(in oklch, var(--group) 55%, transparent)');
      }
      overflow: hidden;
      & > * {
        min-inline-size: 0;
        overflow-wrap: break-word;
      }
      & kbd {
        all: unset;
        font-weight: bold;
        text-transform: uppercase;
        color: var(--muted-text);
      }
      & small {
        font-size: inherit;
        color: var(--muted-text);
      }
    }
    &[data-shift] button {
      & span {
        color: var(--muted-text);
      }
      & small {
        color: var(--text);
        font-weight: bold;
      }
    }
    & > p {
      margin: (base-line / 2) 0 0;
      color: var(--muted-text);
    }
  }
</style>
