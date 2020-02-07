<template lang="html">
  <figure itemscope itemtype="/posters" :itemid="poster.id" v-bind:class="selecting">
    <svg @click="menu = !menu" :preserveAspectRatio="aspect_ratio"
         :viewBox="poster.view_box" v-html="poster.path">
    </svg>
    <figcaption>
      <meta itemprop="view_box" :content="poster.view_box">
      <meta itemprop="created_at" :content="poster.created_at">
      <meta itemprop="created_by" :content="author.id">
      <fieldset>
        <label for="event-picker">{{tonight}}</label>
        <input id="time-picker" type="time" value="21:00" ref="time" >
        <menu v-if="show_event">
          <a v-on:click="remove_event"><icon name="remove"></icon></a>
          <a v-on:click="save_event"><icon name="add"></icon></a>
        </menu>
      </fieldset>
      <menu v-if="menu">
        <a id="create_event" v-if="!is_new">
          <input id="event-picker" type="date" ref="picker" v-model="new_event" @click="manage_event">
          <svg viewBox="0 0 150 150">
            <rect x="1" y="1" rx="8" width="114" height="114" />
            <text class="month" x="57" y="24" text-anchor="middle">{{month}}</text>
            <text x="57" y="84" text-anchor="middle">{{today}}</text>
            <path d="M130.019 110.44H117.56V97.9805C117.56 97.0364 117.185 96.131 116.517 95.4635C115.85 94.7959 114.944 94.4209 114 94.4209C113.056 94.4209 112.151 94.7959 111.483 95.4635C110.816 96.131 110.441 97.0364 110.441 97.9805V110.44H97.9807C97.0367 110.44 96.1313 110.815 95.4637 111.483C94.7962 112.15 94.4211 113.056 94.4211 114C94.4211 114.944 94.7962 115.849 95.4637 116.517C96.1313 117.184 97.0367 117.559 97.9807 117.559H110.441V130.019C110.441 130.963 110.816 131.869 111.483 132.536C112.151 133.204 113.056 133.579 114 133.579C114.944 133.579 115.85 133.204 116.517 132.536C117.185 131.869 117.56 130.963 117.56 130.019V117.559H130.019C130.964 117.559 131.869 117.184 132.536 116.517C133.204 115.849 133.579 114.944 133.579 114C133.579 113.056 133.204 112.15 132.536 111.483C131.869 110.815 130.964 110.44 130.019 110.44V110.44Z" />
            <path d="M88.5442 88.5442C74.4853 102.603 74.4853 125.397 88.5442 139.456C102.603 153.515 125.397 153.515 139.456 139.456C153.515 125.397 153.515 102.603 139.456 88.5442C125.397 74.4853 102.603 74.4853 88.5442 88.5442ZM134.543 134.544C123.198 145.888 104.802 145.889 93.4566 134.544C82.1109 123.198 82.1109 104.803 93.4566 93.4566C104.802 82.1109 123.198 82.1109 134.543 93.4566C145.889 104.803 145.889 123.198 134.543 134.544Z" />
          </svg>
        </a>
        <a @click="delete_me">
          <icon v-if="working" name="working"></icon>
          <icon v-else name="remove"></icon>
        </a>
        <a @click="save" v-if="is_new">
          <icon v-if="accept" name="finished"></icon>
          <icon v-else name="working"></icon>
        </a>
        <download-vector :vector="poster" :author="author"></download-vector>
      </menu>
    </figcaption>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  import download_vector from '@/components/download-vector'
  export default {
    props: {
      poster: {
        type: Object,
        required: true
      },
      author: {
        type: Object,
        required: true
      },
      working: {
        type: Boolean,
        required: false,
        default: false
      },
      is_new: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data() {
      return {
        menu: false,
        accept: true,
        show_event: false,
        new_event: null
      }
    },
    created() {
      if(this.is_new) this.menu = true
    },
    mounted() {
      this.$refs.picker.defaultValue = this.tonight
      this.$refs.picker.value = this.tonight
    },
    components: {
      'download-vector': download_vector,
      icon
    },
    computed: {
      selecting() {
        return {
          'selecting-date': this.show_event
        }
      },
      aspect_ratio() {
        if (this.menu) return `xMidYMid meet`
        else return `xMidYMid slice`
      },
      tonight() {
        const tonight = new Date()
        tonight.setHours(19)
        return tonight.toLocaleString('en-US', { dateStyle: 'full' })
      },
      today() {
        return new Date().toLocaleString('en-US', { day: 'numeric' })
      },
      month() {
        return new Date().toLocaleString('en-US', { month: 'long' })
      }
    },
    methods: {
      selected_event_time(event) {
        console.log("selected_event_time", this.new_event)
      },
      manage_event(event) {
        console.log("manage_event", this.new_event)
        this.show_event = true
        this.$refs.picker.focus()
      },
      remove_event() {
        this.show_event = false
      },
      save_event() {
        this.show_event = false
      },
      delete_me() {
        const message = 'Delete poster?'
        if (window.confirm(message)) this.$emit('delete', this.poster.id)
      },
      save() {
        this.$emit('save', this.poster.id)
      }
    }
  }
</script>
<style lang="stylus">
  figure[itemtype="/posters"]
    overflow: hidden;
    position: relative
    background: green
    @media (min-width: min-screen)
      &:first-of-type:not(.new) // how to handle the first poster on a desktop
        max-width: 50vw
    & > svg
      width: 100%
      height: 100vh
      max-height: page-width
    & > figcaption
      & > fieldset
        display: none
      & > menu
        padding: base-line
        margin-top: -(base-line * 4)
        display: flex
        justify-content: space-between
        a#create_event
          position: relative
          & > input
            position: absolute;
            top: 0
            left: 0
            color: transparent
            z-index: 14
            width: base-line * 2
            height: base-line * 2
            &::-webkit-datetime-edit
            &::-webkit-datetime-edit-fields-wrapper
            &::-webkit-datetime-edit-text
            &::-webkit-datetime-edit-month-field
            &::-webkit-datetime-edit-day-field
            &::-webkit-datetime-edit-year-field
            &::-webkit-inner-spin-button
            &::-webkit-calendar-picker-indicator
              display: none
          svg
            &.has-date
              fill: blue
            text
              fill: white
              font-size: base-line * 2
            text.month
              font-size: (base-line / 2)
              font-weight: 900
            rect, path
              stroke: darken(black, 5%)
              stroke-width: 0.5px
        svg
          fill: red
          &.finished
            fill: blue
</style>
<style lang="stylus">
  figure[itemtype="/posters"].selecting-date
    & > svg
      opacity: 0.1
    & > figcaption
      & > menu
        display: none
      & > fieldset
        margin-top: -(round(base-line * 10.25, 2))
        padding: base-line
        display: flex
        justify-content: space-around
        flex-direction: column
        border:none
        & > label
          text-align: ceter
          display: block;
          line-height: base-line
          margin-bottom: base-line
          color: red
          font-weight: 800
          font-size: base-line
        & > input
          padding: 0
          line-height: 1
          z-index: 44
          cursor: pointer
          color:red
          font-weight: 900
          margin-bottom: base-line * 3
        & > menu
          width: 100%
          z-index: 55
          display: flex
          justify-content: space-between
          & > a > svg
            fill: red
            &.add
              fill: blue
</style>
