<script setup>
  import { computed } from 'vue'
  import icon from '@/components/icon'
  import * as preferences from '@/utils/preference'
  import {
    get_preference_cycle_hint,
    get_preference_cycle_keys,
    get_preference_hint,
    get_preference_icon,
    get_preference_keys
  } from '@/utils/keymaps'
  const props = defineProps({
    name: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: false
    },
    label: {
      type: String,
      required: false
    },
    subtitle: {
      type: String,
      required: false
    },
    show_state: {
      type: Boolean,
      required: false,
      default: false
    },
    icon: {
      type: Boolean,
      default: false
    },
    compact: {
      type: Boolean,
      default: false
    }
  })
  const preference = preferences[props.name]
  const state_text = computed(() => {
    if (!props.show_state) return ''
    return preference.value ? ' (on)' : ' (off)'
  })
  const show_hint = computed(() => !props.compact && !props.title)
  const hint_text = computed(() => {
    if (!show_hint.value) return null
    return get_preference_hint(props.name)
  })
  const key_hint = computed(() => {
    if (!show_hint.value) return []
    return get_preference_keys(props.name)
  })
  const cycle_key_hint = computed(() => {
    if (!show_hint.value) return []
    return get_preference_cycle_keys(props.name)
  })
  const cycle_hint_text = computed(() => {
    if (!show_hint.value) return null
    return get_preference_cycle_hint(props.name)
  })
  const icon_name = computed(() => {
    if (!props.icon) return null
    return get_preference_icon(props.name)
  })
  const apply = new_state => {
    preference.value = new_state

    if (props.name === 'mosaic' && new_state)
      preferences.enable_geology_layers()

    if (props.name === 'shadow' && new_state) preferences.enable_shadow_layers()

    if (props.name === 'drama') {
      preferences.drama_back.value = new_state
      preferences.drama_front.value = new_state
    }
  }

  const on_change = event => apply(event.target.checked)
</script>

<template>
  <fieldset data-preference :class="{ compact }">
    <div>
      <h4 :data-labeled="label || undefined">
        <icon v-if="icon_name" :name="icon_name" />
        <span>{{ label || name }}{{ state_text }}</span>
      </h4>
      <label>
        <input
          :checked="preference"
          :name="name"
          role="switch"
          type="checkbox"
          switch
          @change="on_change" />
        <span data-slider></span>
      </label>
    </div>
    <p v-if="title">{{ title }}</p>
    <p v-else-if="hint_text || key_hint.length" data-hint>
      <span v-if="hint_text">{{ hint_text }}</span>
      <kbd v-for="key in key_hint" :key="key">{{ key }}</kbd>
    </p>
    <p v-if="cycle_key_hint.length && cycle_hint_text" data-hint>
      <kbd v-for="key in cycle_key_hint" :key="`cycle-${key}`">{{ key }}</kbd>
      <span>{{ cycle_hint_text }}</span>
    </p>
    <p v-else-if="subtitle">{{ subtitle }}</p>
    <slot />
  </fieldset>
</template>

<style>
  fieldset[data-preference]:has(input:checked) h4:has(> svg.icon) svg.icon {
    color: var(--emphasis);
  }
  fieldset[data-preference] {
    margin-bottom: var(--base-line);
    &.compact {
      border: none;
      padding: 0;
      margin-bottom: 0;
      min-width: 0;
      & > div {
        gap: calc(var(--base-line) * 0.5);
        align-items: center;
        & > label:has(input[role='switch']) {
          width: calc(var(--base-line) * 2.25);
          height: calc(var(--base-line) * 1.25);
          flex-shrink: 0;
          & > input:checked + [data-slider]:before {
            transform: translateX(calc(var(--base-line) * 1.05));
          }
          [data-slider]:before {
            height: var(--base-line);
            width: var(--base-line);
            left: calc(var(--base-line) * 0.125);
            bottom: calc(var(--base-line) * 0.125);
          }
        }
      }
    }
    & > div {
      display: flex;
      justify-content: space-between;
      h4 {
        text-transform: capitalize;
        &[data-labeled] {
          text-transform: none;
        }
        display: inline-flex;
        align-items: center;
        gap: calc(var(--base-line) * 0.35);
        line-height: 1;
        font-size: normal;
        margin-top: 0;
        &:has(> svg.icon) svg.icon {
          color: var(--accent);
          width: calc(var(--base-line) * 1.1);
          height: calc(var(--base-line) * 1.1);
          flex-shrink: 0;
        }
        .compact > div > & {
          margin: 0;
          font-size: smaller;
          &:has(> svg.icon) svg.icon {
            width: var(--base-line);
            height: var(--base-line);
          }
        }
      }
    }
    & > p[data-hint] {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: calc(var(--base-line) * 0.5);
      margin: 0;
      line-height: 1.4;
      font-size: smaller;
      opacity: 0.8;
      kbd {
        margin: 0;
      }
    }
    a {
      color: var(--accent);
      border-color: var(--accent);
    }
  }
</style>
