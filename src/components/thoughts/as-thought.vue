<script setup>
  /** @typedef {import('@/types').Thought_Item} Thought_Item */
  import { ref, computed, watch, nextTick, inject } from 'vue'
  const props = defineProps({
    thought: {
      /** @type {import('vue').PropType<Thought_Item>} */
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
  const thought_text = computed(
    () => props.thought.thought ?? props.thought.statement ?? ''
  )

  const set_initial_content = () => {
    const el = is_editable.value
    if (!el || document.activeElement?.isSameNode(el)) return
    el.textContent = thought_text.value
  }
  watch(
    () => [props.editable, props.thought.id],
    () => nextTick(set_initial_content),
    { immediate: true }
  )

  /**
   * @returns {Promise<void>}
   */
  const save = async () => {
    const possibly_changed = is_editable.value?.textContent?.trim()
    if (thought_text.value !== possibly_changed && update_statement)
      await update_statement(props.thought.id, possibly_changed ?? '')
    emit('blurred', props.thought)
  }

  const focused = () => {
    emit('focused', props.thought)
  }

  const focus_editor = () => {
    is_editable.value?.focus()
  }

  defineExpose({ focus_editor })
</script>

<template>
  <div
    itemscope
    :itemid="thought.id"
    @click="
      e => {
        if (editable) {
          e.stopPropagation()
          focus_editor()
        }
      }
    ">
    <p
      v-if="editable"
      ref="is_editable"
      tabindex="0"
      :spellcheck="true"
      :contenteditable="true"
      itemprop="statement"
      @focus="focused"
      @blur.prevent="save" />
    <p v-else itemprop="statement">{{ thought_text }}</p>
    <meta v-if="thought.why" itemprop="why" :content="thought.why" />
    <meta v-if="thought.where" itemprop="where" :content="thought.where" />
  </div>
</template>
