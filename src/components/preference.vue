<template>
  <fieldset class="preference">
    <div>
      <h3>{{ name }}</h3>
      <label class="switch">
        <input type="checkbox" />
        <span class="slider"></span>
      </label>
    </div>
    <p>{{ title }}</p>
  </fieldset>
</template>
<script>
  export default {
    props: {
      name: {
        type: String,
        required: true
      },
      title: {
        type: String,
        required: false
      },
      default: {
        type: String,
        required: false
      },
      option: {
        type: String,
        required: false
      }
    }
  }
</script>
<style lang="stylus">
  fieldset.preference
    & > div
      display: flex
      justify-content: space-between
      h3
        text-transform: capitalize
        display: inline-block
        line-height: 1
        margin: 0 0 base-line 0
        padding: 0
      & > label.switch
        position: relative
        display: inline-block
        width: base-line * 3
        height: base-line * 1.5
        & > input
          opacity: 0
          width: 0
          height: 0
          &:checked + .slider
            background-color: green
          &:focus + .slider
            box-shadow: 0 0 1px red
          &:checked + .slider:before
            transform: translateX(base-line * 1.5)
        .slider
          border-radius: base-line * 2
          position: absolute
          cursor: pointer
          top: 0
          left: 0
          right: 0
          bottom: 0
          background-color: black
          -webkit-transition: .4s
          transition: .4s
          &:before
            border-radius: 50%
            position: absolute
            content: ""
            height: base-line
            width: base-line
            left: base-line * .25
            bottom: base-line * .25
            background-color: white
            opacity: 0.5
            -webkit-transition: .4s
            transition: .4s
    & > p
      margin: 0
</style>
