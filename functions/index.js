'use strict'
const functions = require('firebase-functions')
const {create_locals, download, resize,
  trace, upload, cleanup} = require('./ConvertToAvatar')
exports.convert_to_avatar = functions.storage.object().onFinalize(image => {
  if (!image.contentType.startsWith('image/')) {
    return false
  }
  if (image.contentType.startsWith('image/svg')) {
    console.log(image.name)
    return false
  }
  return create_locals(image)
    .then(download)
    .then(resize)
    .then(trace)
    // .then(optimize)
    .then(upload)
    .then(cleanup)
})
