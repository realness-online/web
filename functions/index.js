'use strict'
const functions = require('firebase-functions')
const gcs = require('@google-cloud/storage')()
const spawn = require('child-process-promise').spawn

exports.convert_to_avatar = functions.storage.bucket('/people').object().onFinalize(event => {

})
