// import * as tf from '@tensorflow/tfjs-core'
// import '@tensorflow/tfjs-backend-cpu'
// import '@tensorflow/tfjs-backend-webgl'
// import '@tensorflow/tfjs-backend-wasm'
// import * as coco_ssd from '@tensorflow-models/coco-ssd'
import { ref, onMounted as mounted } from 'vue'
//['lite_mobilenet_v2', 'mobilenet_v1', 'mobilenet_v2'],

export const use = () => {
  const coco_model = ref(null)
  const depth_model = ref(null)
  const video = ref(null)
  const canvas = ref(null)
  mounted(async () => {
    console.time('robot:awakens')
    // await tf.ready()
    // await tf.setBackend('webgl')
    coco_model.value = Object
      .freeze
      // await coco_ssd.load({ base: 'mobilenet_v2' })
      ()
    console.timeEnd('robot:awakens')
    await predict()
  })
  const snapshot = () => {
    const ctx = canvas.value.getContext('2d')
    ctx.drawImage(video.value, 0, 0)
  }
  const predict = async () => {
    if (!coco_model.value) return
    snapshot()
    const predictions = await coco_model.value.detect(canvas.value)
    predictions.forEach(prediction => {
      console.log('prediction', prediction)
    })
    // Call this function again to keep predicting when the browser is ready.
    // window.requestAnimationFrame(predict);
  }
  return {
    coco_model,
    depth_model,
    video,
    canvas,
    predict
  }
}
