const path = require('path')
const os = require('os')
const spawn = require('child-process-promise').spawn
const admin = require('firebase-admin')
const mkdirp = require('mkdirp-promise')
const potrace = require('potrace')
const fs = require('fs')
const SVGO = require('svgo')
const svgo = new SVGO({
  plugins: [
    {
      removeViewBox: false
    },
    {
      removeDimensions: true
    }
  ]
})
function replace_type(path, extension) {
  return path.replace(/\.[^/.]+$/, extension)
}
function delete_locals(locals) {
  fs.unlinkSync(locals.avatar)
  fs.unlinkSync(locals.image)
}
admin.initializeApp()
exports.create_locals = (image) => {
  return new Promise((resolve, reject) => {
    let locals = {}
    locals.bucket = image.bucket
    locals.name = image.name
    locals.image = path.join(os.tmpdir(), locals.name)
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
    console.log('download...', locals.name)
    const bucket = admin.storage().bucket()
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
    const properties = [locals.image, '-resize', '512x512>', locals.image]
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
    potrace.trace(locals.image, function(err, svg) {
      if (err) { reject(err) }
      fs.writeFileSync(locals.avatar, svg)
      resolve(locals)
    })
  })
}
exports.optimize = (locals) => {
  return new Promise((resolve, reject) => {
    console.log('optimize...')
    fs.readFile(locals.avatar, 'utf8', (err, data) => {
      if (err) { reject(err) }
      svgo.optimize(data).then(result => {
        fs.writeFileSync(locals.avatar, result.data)
        resolve(locals)
      }).catch(error => reject(error))
    })
  })
}
exports.upload = (locals) => {
  return new Promise((resolve, reject) => {
    console.log('upload...')
    const destination_avatar = replace_type(locals.name, '.svg')
    const bucket = admin.storage().bucket()
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
    delete_locals(locals)
    const bucket = admin.storage().bucket()
    bucket.file(locals.name).delete().then((results) => {
      resolve(locals)
    }).catch(error => {
      reject(error)
    })
  })
}
// example of croping image to a square:
//  https://www.imagemagick.org/discourse-server/viewtopic.php?t=28283
