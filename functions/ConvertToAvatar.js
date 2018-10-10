const path = require('path')
const os = require('os')
const {Storage} = require('@google-cloud/storage')
const spawn = require('child-process-promise').spawn
const mkdirp = require('mkdirp-promise')
const potrace = require('potrace')
const fs = require('fs')
function replace_type(path, extension) {
  return path.replace(/\.[^/.]+$/, extension)
}
exports.create_locals = (image) => {
  return new Promise((resolve, reject) => {
    console.log('create_locals...', image)
    let locals = {}
    locals.bucket = image.bucket
    locals.name = image.name
    locals.image = path.join(os.tmpdir(), path.basename(locals.name))
    locals.bitmap = replace_type(locals.image, '.pnm')
    locals.avatar = replace_type(locals.image, '.svg')
    mkdirp(path.dirname(locals.image)).then(() => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
exports.download = (locals) => {
  return new Promise((resolve, reject) => {
    console.log('download...')
    const storage = new Storage()
    const bucket = storage.bucket(locals.bucket)
    bucket.file(locals.name).download({
      destination: locals.image
    }).then(() => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
exports.resize = (locals) => {
  return new Promise((resolve, reject) => {
    console.log('resize...')
    const properties = [locals.image, '-resize', '200x200>', locals.bitmap]
    spawn('convert', properties).then(() => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
exports.trace = (locals) => {
  return new Promise((resolve, reject) => {
    console.log('trace...')
    potrace.trace(locals.bitmap, function(err, svg) {
      if (err) {
        reject(err)
      }
      fs.writeFileSync(locals.avatar, svg)
      resolve(locals)
    })
  })
}
exports.optimize = (locals) => {
  return new Promise((resolve, reject) => {
    console.log('optimize...')
    const properties = [locals.avatar, '--enable=removeDimensions']
    spawn('svgo', properties).then(() => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
exports.upload = (locals) => {
  return new Promise((resolve, reject) => {
    console.log('upload...')
    const destination_avatar = replace_type(locals.name, 'svg')
    const storage = new Storage()
    const bucket = storage.bucket(locals.bucket)
    bucket.upload(locals.avatar, {
      destination: destination_avatar
    }).then((results) => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
exports.cleanup = (locals) => {
  return new Promise((resolve, reject) => {
    console.log('cleanup...')
    fs.unlinkSync(locals.avatar)
    fs.unlinkSync(locals.bitmap)
    fs.unlinkSync(locals.image)
    const storage = new Storage()
    const bucket = storage.bucket(locals.bucket)
    bucket.file(locals.name).delete().then((results) => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}

// service firebase.storage {
//   match /b/{bucket}/o {
//     // Files look like: "people/<mobile>/path/to/file.txt"
//     match /people/{mobile}/{allPaths=**}{
//       allow read: if request.auth != null
//       allow write: if request.auth.token.phone_number == mobile
//     }
//   }
// }

// reference links:
// for croping to a square
//  https://www.imagemagick.org/discourse-server/viewtopic.php?t=28283
// removing file extension
//  https://stackoverflow.com/questions/39007908/filename-without-extension-terminology

// this.local_image = path.join(os.tmpdir(), path.basename(image.name))
// this.as_file = this.local_image.replace(/\.[^/.]+$/, "")
// this.server_image  = image.name

// const fileBucket = image.bucket // The Storage bucket that contains the file.
// const filePath = image.name // File path in the bucket.
// // const contentType = image.contentType // File content type.
// const resourceState = image.resourceState // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
// const metageneration = image.metageneration // Number of times metadata has been generated. New objects have a value of 1.

// // Download file from bucket.
// const bucket = gcs.bucket(fileBucket)
// const tempFilePath = `/tmp/${fileName}`
// return bucket.file(filePath).download({
//   destination: tempFilePath
// }).then(() => {
//   console.log('Image downloaded locally to', tempFilePath)
//   // Generate a thumbnail using ImageMagick.
//   return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath]).then(() => {
//     console.log('Thumbnail created at', tempFilePath)
//     // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
//     const thumbFilePath = filePath.replace(/(\/)?([^\/]*)$/, '$1thumb_$2')
//     // Uploading the thumbnail.
//     return bucket.upload(tempFilePath, {
//       destination: thumbFilePath
//     })
//   })
// })
