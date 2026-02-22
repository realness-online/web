<script setup>
  /** @typedef {import('@/types').Thought_Item} Thought_Item */
  import { Thought } from '@/persistance/Storage'
  import { ref, computed } from 'vue'
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
  const is_editable = ref(null)
  const thought_text = computed(
    () => props.thought.thought ?? props.thought.statement ?? ''
  )

  /**
   * @returns {Promise<void>}
   */
  const save = async () => {
    const possibly_changed = is_editable.value?.textContent?.trim()
    if (thought_text.value !== possibly_changed) {
      const thought = new Thought()
      await thought.save()
    }
    emit('blurred', props.thought)
  }

  const focused = () => {
    emit('focused', props.thought)
  }
</script>

<template>
  <div itemscope :itemid="thought.id">
    <p
      v-if="editable"
      ref="is_editable"
      :spellcheck="true"
      :contenteditable="true"
      itemprop="thought"
      @focus="focused"
      @blur.prevent="save">
      {{ thought_text }}
    </p>
    <p v-else itemprop="thought">{{ thought_text }}</p>
    <meta v-if="thought.why" itemprop="why" :content="thought.why" />
    <meta v-if="thought.where" itemprop="where" :content="thought.where" />
  </div>
</template>
