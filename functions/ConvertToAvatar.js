const path = require('path')
const os = require('os')
const storage = require('@google-cloud/storage')()
const spawn = require('child-process-promise').spawn
const potrace = require('potrace')
const fs = require('fs')

// download(image)
// .then(square)
// .then(resize)
// .then(trace)
// .then(optimize)
// .then(upload)
// .then(cleanup)

exports.download = (image) => {
  return new Promise((resolve, reject) => {
    const local_image = path.join(os.tmpdir(), path.basename(image.name))
    storage.bucket('/people').file(image.name).download({
      destination: local_image
    }).then(() => {
      // console.log(local_image)
      resolve(local_image)
    }).catch(error => {
      reject(error)
    })
  })
}

exports.resize = (local_image) => {
  // console.log(local_image)
  const properties = [local_image, '-resize', '200x200>', local_image]
  return new Promise((resolve, reject) => {
    spawn('convert', properties).then(() => {
      resolve(local_image)
    }).catch(error => {
      reject(error)
    })
  })
}

exports.trace = (local_image) => {
  return new Promise((resolve, reject) => {
    const local_avatar = local_image.replace(/\.[^/.]+$/, ".svg")
    potrace.trace(local_image, function(err, svg) {
      if (err) {
        reject(err)
      }
      fs.writeFileSync(local_avatar, svg);
      resolve(local_avatar)
    })
  })
}

// reference links:
// for croping to a square
//  https://www.imagemagick.org/discourse-server/viewtopic.php?t=28283
// removing file extension
//  https://stackoverflow.com/questions/39007908/filename-without-extension-terminology

// this.local_image = path.join(os.tmpdir(), path.basename(image.name))
// this.as_file = this.local_image.replace(/\.[^/.]+$/, "")
// this.server_image  = image.name

// const fileBucket = image.bucket; // The Storage bucket that contains the file.
// const filePath = image.name; // File path in the bucket.
// // const contentType = image.contentType; // File content type.
// const resourceState = image.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
// const metageneration = image.metageneration; // Number of times metadata has been generated. New objects have a value of 1.

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
