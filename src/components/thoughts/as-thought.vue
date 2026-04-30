<script setup>
  /** @typedef {import('@/types').Statement} Statement */
  import {
    ref,
    computed,
    watch,
    nextTick,
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
    editable: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const emit = defineEmits(['blurred', 'focused'])
  /** @type {((id: string, content: string) => Promise<void>) | undefined} */
  const update_statement = inject('update_statement')
  /** @type {import('vue').Ref<HTMLParagraphElement | null>} */
  const is_editable = ref(null)
  const thought_text = computed(() => props.thought.statement ?? '')

  /** Desktop-like pointers: read-only shell until deliberate edit, avoids stray single-clicks. */
  const desktop_edit_gate = ref(false)
  const actively_editing = ref(false)

  const DESKTOP_EDIT_MQ = '(hover: hover) and (pointer: fine)'
  /** @type {null | (() => void)} */
  let stop_desktop_mq = null

  mounted(() => {
    const mq = globalThis.matchMedia?.(DESKTOP_EDIT_MQ)
    if (!mq) return
    const sync = () => {
      desktop_edit_gate.value = mq.matches
      if (!mq.matches) actively_editing.value = false
    }
    sync()
    mq.addEventListener('change', sync)
    stop_desktop_mq = () => mq.removeEventListener('change', sync)
  })

  before_unmount(() => {
    stop_desktop_mq?.()
  })

  const set_initial_content = () => {
    const el = is_editable.value
    if (!el || document.activeElement?.isSameNode(el)) return
    el.textContent = thought_text.value
  }
  watch(
    () => [props.editable, props.thought.id],
    () => {
      actively_editing.value = false
      nextTick(set_initial_content)
    },
    { immediate: true }
  )

  /**
   * @returns {Promise<void>}
   */
  const save = async () => {
    const possibly_changed = is_editable.value?.textContent?.trim()
    if (thought_text.value !== possibly_changed && update_statement)
      await update_statement(props.thought.id, possibly_changed ?? '')
    if (desktop_edit_gate.value) actively_editing.value = false
    emit('blurred', props.thought)
  }

  const focused = () => {
    emit('focused', props.thought)
  }

  const focus_editor = () => {
    if (!props.editable) return
    if (desktop_edit_gate.value) {
      actively_editing.value = true
      nextTick(() => {
        set_initial_content()
        is_editable.value?.focus()
      })
    } else
      nextTick(() => {
        is_editable.value?.focus()
      })
  }

  /**
   * @param {MouseEvent} e
   */
  const on_wrapper_click = e => {
    if (!props.editable || desktop_edit_gate.value) return
    if (/** @type {Element} */ (e.target).closest?.('[contenteditable="true"]'))
      return
    e.stopPropagation()
    focus_editor()
  }

  /**
   * @param {MouseEvent} e
   */
  const on_wrapper_dblclick = e => {
    if (!props.editable || !desktop_edit_gate.value) return
    e.stopPropagation()
    focus_editor()
  }

  defineExpose({ focus_editor })
</script>

<template>
  <div
    itemscope
    :itemid="thought.id"
    @click="on_wrapper_click"
    @dblclick="on_wrapper_dblclick">
    <p v-if="!editable" itemprop="statement">{{ thought_text }}</p>
    <p v-else-if="desktop_edit_gate && !actively_editing" itemprop="statement">
      {{ thought_text }}
    </p>
    <p
      v-else-if="editable"
      ref="is_editable"
      tabindex="0"
      :spellcheck="true"
      :contenteditable="true"
      itemprop="statement"
      @focus="focused"
      @blur.prevent="save" />
  </div>
</template>
