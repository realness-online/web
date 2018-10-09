const path = require('path')
const os = require('os')
const storage = require('@google-cloud/storage')()
const spawn = require('child-process-promise').spawn
const potrace = require('potrace')
const fs = require('fs')
function replace_type(path, extension){
  return path.replace(/\.[^/.]+$/, extension)
}

// TODO: delete
//   local_image
//   local_bitmap
//   local_avatar
exports.create_locals = (image) => {
  let locals = {}
  locals.name = image.name
  locals.image = path.join(os.tmpdir(), path.basename(locals.name))
  locals.bitmap = replace_type(locals.image, ".pnm")
  locals.avatar = replace_type(locals.image, ".svg")
  return locals
}
exports.download = (locals) => {
  return new Promise((resolve, reject) => {
    storage.bucket('/people').file(locals.name).download({
      destination: locals.image
    }).then(() => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
exports.resize = (locals) => {
  const properties = [locals.image, '-resize', '200x200>', locals.bitmap]
  return new Promise((resolve, reject) => {
    spawn('convert', properties).then(() => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
exports.trace = (locals) => {
  return new Promise((resolve, reject) => {
    potrace.trace(locals.bitmap, function(err, svg) {
      if (err) {
        reject(err)
      }
      fs.writeFileSync(locals.avatar, svg);
      resolve(locals)
    })
  })
}
exports.optimize = (locals) => {
  const properties = [locals.avatar, '--enable=removeDimensions']
  return new Promise((resolve, reject) => {
    spawn('svgo', properties).then(() => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
exports.upload = (locals) => {
  return new Promise((resolve, reject) => {
    const destination_avatar = replace_type(locals.name, 'svg')
    storage.bucket('/people').upload(locals.avatar, {
      destination: destination_avatar
    }).then((results) => {
      resolve(locals)
    }).catch(error => {
      reject(error)
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
