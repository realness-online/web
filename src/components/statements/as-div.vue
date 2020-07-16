<template lang="html">
  <div itemscope :itemid="statement.id">
    <p v-if="editable" ref="editable" contenteditable="true" itemprop="statement" @blur.prevent="save">{{ statement.statement }}</p>
    <p v-else itemprop="statement">{{ statement.statement }}</p>
    <meta v-if="statement.why" itemprop="why" :content="statement.why">
    <meta v-if="statement.where" itemprop="where" :content="statement.where">
  </div>
</template>
<script>
  import { Statements } from '@/persistance/Storage'
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
    methods: {
      save (event) {
        const possibly_changed = this.$refs.editable.textContent.trim()
        if (this.statement.statement !== possibly_changed) new Statements().save()
      }
    }
  }
</script>
