<template>
  <ul>
    <li v-for="file in files" :key="file.path" :data-kind="file.kind">
      <button v-if="file.kind === 'folder'" type="button" @click="open(file)">
        {{ file.name }}
      </button>
      <button v-else type="button" @click="open(file)">{{ file.name }}</button>
      <small v-if="file.kind === 'file'">{{ size_of(file.size) }}</small>
    </li>
  </ul>
</template>

<script setup>
  defineProps({
    files: { type: Array, required: true }
  })

  const emit = defineEmits(['open'])

  const KILOBYTE = 1024
  const MEGABYTE = KILOBYTE * KILOBYTE

  /** A size in the largest unit that keeps it readable. */
  const size_of = bytes => {
    if (bytes >= MEGABYTE) return `${Math.round(bytes / MEGABYTE)} MB`
    if (bytes >= KILOBYTE) return `${Math.round(bytes / KILOBYTE)} KB`
    return `${bytes} B`
  }

  const open = file => emit('open', file)
</script>

<style lang="stylus">
  ul {
    display: grid;
    gap: calc(var(--base-line) * 0.25);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.875rem;

    li {
      display: flex;
      align-items: baseline;
      gap: calc(var(--base-line) * 0.5);

      button {
        font: inherit;
        padding: 0;
        background: none;
        border: 0;
        color: var(--text);
        text-align: start;
        cursor: pointer;

        &:hover {
          color: var(--accent);
        }
      }

      &[data-kind='folder'] button::before {
        content: '';
        display: inline-block;
        inline-size: 0.6em;
        block-size: 0.6em;
        margin-inline-end: 0.4em;
        border: 1px solid var(--muted-text);
      }

      small {
        color: var(--muted-text);
        font-size: 0.75rem;
      }
    }
  }
</style>
