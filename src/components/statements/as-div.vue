<script>
  import { Statement } from '@/persistance/Storage'
  export default {
    props: {
      statement: {
        type: Object,
        required: true
      },
      editable: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    emits: ['blurred', 'focused'],
    methods: {
      async save() {
        const possibly_changed = this.$refs.editable.textContent.trim()
        if (this.statement.statement !== possibly_changed) {
          const statement = new Statement()
          await statement.save()
        }
        this.$emit('blurred', this.statement)
      },
      focused() {
        this.$emit('focused', this.statement)
      }
    }
  }
</script>

<template>
  <div itemscope :itemid="statement.id">
    <p
      v-if="editable"
      ref="editable"
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
