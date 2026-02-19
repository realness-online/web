<script setup>
  import { Statement } from '@/persistance/Storage'
  import { ref } from 'vue'
  const props = defineProps({
    thought: {
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

  /**
   * @returns {Promise<void>}
   */
  const save = async () => {
    const possibly_changed = is_editable.value?.textContent?.trim()
    if (props.thought.statement !== possibly_changed) {
      const statement = new Statement()
      await statement.save()
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
      itemprop="statement"
      @focus="focused"
      @blur.prevent="save">
      {{ thought.statement }}
    </p>
    <p v-else itemprop="statement">{{ thought.statement }}</p>
    <meta v-if="thought.why" itemprop="why" :content="thought.why" />
    <meta v-if="thought.where" itemprop="where" :content="thought.where" />
  </div>
</template>
