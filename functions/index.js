'use strict';
const functions = require('firebase-functions')
const {create_locals, download, resize, trace} = require('./ConvertToAvatar')
exports.convert_to_avatar = functions.storage.bucket('/people').object()
.onFinalize(image => {
  if (!image.contentType.startsWith('image/')) {
    // Exit if this is triggered on a file that is not an image.
    console.log('This is not an image.')
    return
  }
  if (image.contentType.startsWith('image/svg')) {
    // Exit if this is triggered on a file that is not an image.
    console.log('Already an SVG')
    return
  }
  if (image.resourceState === 'exists' && image.metageneration > 1) {
    // Exit if file exists but is not new and is only being triggered
    // because of a metadata change.
    console.log('This is a metadata change event.')
    return
  }
  const locals = create_locals(image)
  download(locals)
    // .then(square)
    // .then(resize)
    // .then(trace)
    // .then(optimize)
    // .then(upload)
    // .then(cleanup)
});
