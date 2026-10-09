<script setup>
  /** @typedef {import('@/types').Statement} Statement */
  import {
    ref,
    computed,
    watch,
    inject,
    onMounted as mounted,
    onBeforeUnmount as before_unmount
  } from 'vue'

  const props = defineProps({
    thought: {
      /** @type {import('vue').PropType<Statement>} */
      type: Object,
      required: true
    },
    editable: { type: Boolean, default: false }
  })
  const emit = defineEmits(['blurred', 'focused'])
  /** @type {((id: string, content: string) => Promise<void>) | undefined} */
  const update_statement = inject('update_statement')
  /** @type {import('vue').Ref<HTMLParagraphElement | null>} */
  const editor = ref(null)
  const thought_text = computed(() => props.thought.statement ?? '')
  const actively_editing = ref(false)
  const starting_text = ref('')
  // Freeze Vue's text while the browser owns the caret, including during sync.
  const rendered_text = computed(() =>
    actively_editing.value ? starting_text.value : thought_text.value
  )
  const desktop_edit_gate = ref(false)
  const DESKTOP_EDIT_MQ = '(hover: hover) and (pointer: fine)'
  /** @type {null | (() => void)} */
  let stop_desktop_mq = null

  mounted(() => {
    const mq = globalThis.matchMedia?.(DESKTOP_EDIT_MQ)
    if (!mq) return
    const sync = () => (desktop_edit_gate.value = mq.matches)
    sync()
    mq.addEventListener('change', sync)
    stop_desktop_mq = () => mq.removeEventListener('change', sync)
  })
  before_unmount(() => stop_desktop_mq?.())

  watch([() => props.editable, () => props.thought.id], () => {
    actively_editing.value = false
  })

  /** Keep focus in the user gesture so touch browsers can open the keyboard. */
  const focus_editor = () => {
    const el = editor.value
    if (!props.editable || !el) return
    if (!actively_editing.value) {
      // A resting paragraph can already have keyboard focus.
      el.blur()
      starting_text.value = thought_text.value
      el.textContent = starting_text.value
      actively_editing.value = true
      el.setAttribute('contenteditable', 'true')
    }
    el.focus()
  }

  const on_focus = () => emit('focused', props.thought)

  const on_blur = async () => {
    const el = editor.value
    if (!el || !actively_editing.value) return
    const { id } = props.thought
    const changed = (el.innerText ?? el.textContent ?? '').trim()
    if (changed !== starting_text.value && update_statement)
      await update_statement(id, changed)
    if (props.thought.id === id && document.activeElement !== el)
      actively_editing.value = false
    emit('blurred', props.thought)
  }

  /** Enter opens or saves; shift-enter and text composition stay in the editor. */
  const on_enter = event => {
    if (!props.editable) return
    event.stopPropagation()
    if (event.isComposing || (actively_editing.value && event.shiftKey)) return
    event.preventDefault()
    if (actively_editing.value) editor.value?.blur()
    else focus_editor()
  }

  const on_wrapper_click = event => {
    if (!props.editable) return
    event.stopPropagation()
    if (actively_editing.value) return
    if (
      desktop_edit_gate.value &&
      event.pointerType !== 'touch' &&
      thought_text.value !== ''
    )
      return
    focus_editor()
  }

  const on_wrapper_dblclick = event => {
    if (!props.editable || !desktop_edit_gate.value) return
    event.stopPropagation()
    focus_editor()
  }

  defineExpose({ focus_editor })
</script>

<template>
  <div
    itemscope
    :itemid="thought.id"
    :data-editable="editable || undefined"
    @click="on_wrapper_click"
    @dblclick="on_wrapper_dblclick">
    <p
      ref="editor"
      itemprop="statement"
      :tabindex="editable ? 0 : undefined"
      :role="editable ? 'textbox' : undefined"
      :aria-label="editable ? 'Statement' : undefined"
      :aria-readonly="editable ? !actively_editing : undefined"
      :spellcheck="editable"
      :contenteditable="actively_editing || undefined"
      @focus="on_focus"
      @keydown.enter="on_enter"
      @blur="on_blur">
      {{ rendered_text }}
    </p>
  </div>
</template>

<style>
  div[itemscope][data-editable] {
    cursor: text;
  }
</style>
