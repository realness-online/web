'use strict';
const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
exports.convert_to_avatar = functions.storage.bucket('/people').object().onFinalize(image => {

  const fileBucket = image.bucket; // The Storage bucket that contains the file.
  const filePath = image.name; // File path in the bucket.
  const contentType = image.contentType; // File content type.
  const resourceState = image.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
  const metageneration = image.metageneration; // Number of times metadata has been generated. New objects have a value of 1.

  if (!contentType.startsWith('image/')) {
    // Exit if this is triggered on a file that is not an image.
    console.log('This is not an image.');
    return;
  }
  // Get the file name.
  const fileName = filePath.split('/').pop();

  if (fileName.startsWith('thumb_')) {
    // Exit if the image is already a thumbnail.
    console.log('Already a Thumbnail.');
    return;
  }

  if (resourceState === 'exists' && metageneration > 1) {
    // Exit if file exists but is not new and is only being triggered
    // because of a metadata change.
    console.log('This is a metadata change event.');
    return;
  }

  // // Download file from bucket.
  // const bucket = gcs.bucket(fileBucket);
  // const tempFilePath = `/tmp/${fileName}`;
  // return bucket.file(filePath).download({
  //   destination: tempFilePath
  // }).then(() => {
  //   console.log('Image downloaded locally to', tempFilePath);
  //   // Generate a thumbnail using ImageMagick.
  //   return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath]).then(() => {
  //     console.log('Thumbnail created at', tempFilePath);
  //     // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
  //     const thumbFilePath = filePath.replace(/(\/)?([^\/]*)$/, '$1thumb_$2');
  //     // Uploading the thumbnail.
  //     return bucket.upload(tempFilePath, {
  //       destination: thumbFilePath
  //     });
  //   });
  // });

});
