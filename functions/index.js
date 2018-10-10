'use strict'
const functions = require('firebase-functions')
const {create_locals, download, resize,
  trace, optimize, upload, cleanup} = require('./ConvertToAvatar')
exports.convert_to_avatar = functions.storage.bucket().object().onFinalize(image => {
  if (!image.contentType.startsWith('image/')) {
    // Exit if this is triggered on a file that is not an image.
    console.log('This is not an image.')
    return
  }
  if (image.contentType.startsWith('image/svg')) {
    // Exit if file is already an SVG
    console.log('Already an SVG')
    return
  }
  if (image.resourceState === 'exists' && image.metageneration > 1) {
    // Exit if file exists but is not new and is only being triggered
    // because of a metadata change.
    console.log('This is a metadata change event.')
    return
  }
  create_locals(image)
    .then(download)
    .then(resize)
    .then(trace)
    .then(optimize)
    .then(upload)
    .then(cleanup)
})
