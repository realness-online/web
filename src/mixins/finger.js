import AlloyFinger from 'alloyfinger'
export const gestures = [
  'touchStart',
  'touchMove',
  'touchEnd',
  'touchCancel',
  'multipointStart',
  'multipointEnd',
  'tap',
  'doubleTap',
  'longTap',
  'singleTap',
  'rotate',
  'pinch',
  'pressMove',
  'swipe'
]

// <svg v-finger:press-move="change-opacity">
// <svg v-finger:swipe="change-opacity">
export default {
  directives: {
    finger: {
      beforeMount (el, binding) {
        const { value: callback, arg } = binding
        if (!gestures.includes(arg)) throw new Error(`${arg} gesture is not supported`)
        if (typeof callback !== 'function') throw new Error('The v-finger value should be a function')
        new AlloyFinger(el, { // eslint-disable-line
          [arg]: callback
        })
      }
    }
  }
}
