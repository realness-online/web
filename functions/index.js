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
  if (image.resourceState === 'exists' && image.metageneration > 1) {
    // Exit if file exists but is not new and is only being triggered
    // because of a metadata change. don't need this because a jpg
    // won't stick around
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
