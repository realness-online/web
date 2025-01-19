<script setup>
  import { Statement } from '@/persistance/Storage'
  import { ref } from 'vue'
  const props = defineProps({
    statement: {
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
    if (props.statement.statement !== possibly_changed) {
      const statement = new Statement()
      await statement.save()
    }
    emit('blurred', props.statement)
  }

  const focused = () => {
    emit('focused', props.statement)
  }
</script>

<template>
  <div itemscope :itemid="statement.id">
    <p
      v-if="editable"
      ref="is_editable"
      :spellcheck="true"
      :contenteditable="true"
      itemprop="statement"
      @focus="focused"
      @blur.prevent="save">
      {{ statement.statement }}
    </p>
    <p v-else itemprop="statement">{{ statement.statement }}</p>
    <meta v-if="statement.why" itemprop="why" :content="statement.why" />
    <meta v-if="statement.where" itemprop="where" :content="statement.where" />
  </div>
</template>
