<template>
  <ol :aria-label="label">
    <li v-for="row in lines" :key="row">
      <ol>
        <li
          v-for="cell in cells_of(row)"
          :key="cell.key"
          :data-group="cell.group"
          :data-reserved="cell.reserved"
          :aria-pressed="cell.pressed">
          <kbd>{{ cell.cap }}</kbd>
          <span>{{ cell.option }}</span>
          <small>{{ cell.shifted }}</small>
        </li>
      </ol>
    </li>
  </ol>
</template>

<script setup>
  import { computed } from 'vue'

  const props = defineProps({
    /** The key map: each key to [group, option label, Option+Shift label]. */
    map: { type: Object, required: true },
    rows: { type: Array, required: true },
    panel: { type: Boolean, default: false },
    panel_on: { type: Array, default: () => [] },
    pi_reserved: { type: Array, default: () => [] },
    pi_windows: { type: Array, default: () => [] },
    reserved: { type: Boolean, default: false },
    label: { type: String, default: 'Keys' }
  })

  const lines = computed(() =>
    ' ' in props.map ? [...props.rows, ' '] : props.rows
  )

  /** A space key reads as Space; every other key reads in upper case. */
  const cap_of = key => (key === ' ' ? 'Space' : key.toUpperCase())

  const reserved_of = key => {
    if (props.pi_reserved.includes(key)) return 'pi'
    if (props.pi_windows.includes(key)) return 'windows'
    return undefined
  }

  const cell_of = key => {
    const [group, option, shifted] = props.map[key] ?? []
    return {
      key,
      cap: cap_of(key),
      option: option ?? '',
      shifted: shifted ?? '',
      group,
      reserved: props.reserved ? reserved_of(key) : undefined,
      pressed: props.panel && props.panel_on.includes(key) ? 'true' : undefined
    }
  }

  const cells_of = row => [...row].map(cell_of)
</script>

<style lang="stylus">
  ol {
    display: grid;
    gap: calc(var(--base-line) * 0.25);
    margin: 0;
    padding: 0;
    list-style: none;

    ol {
      display: grid;
      grid-auto-columns: minmax(0, 1fr);
      grid-auto-flow: column;
      gap: calc(var(--base-line) * 0.25);

      > li {
        display: grid;
        align-content: start;
        gap: 0.15em;
        min-block-size: 3.5em;
        padding: 0.3em 0.4em;
        border: 1px solid var(--muted-text);
        font-size: 0.75rem;
        line-height: 1.2;

        &[data-group='layers'] {
          border-color: var(--accent);
        }

        &[data-group='poster'] {
          border-color: var(--emphasis);
        }

        &[data-group='view'] {
          border-color: var(--accent);
        }

        &[data-group='chat'],
        &[data-group='go'],
        &[data-group='app'],
        &[data-group='terminal'] {
          border-color: var(--muted-text);
        }

        &[data-reserved] {
          border-style: dashed;
        }

        &[aria-pressed='true'] {
          border-color: var(--emphasis);
          background: var(--code-surface);
        }

        kbd {
          font-family: inherit;
          font-weight: 700;
        }

        small {
          color: var(--muted-text);
        }
      }
    }
  }
</style>
