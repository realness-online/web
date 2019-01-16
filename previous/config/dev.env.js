'use strict'
const merge = require('webpack-merge')
const prodEnv = require('./prod.env')

module.exports = merge(prodEnv, {
  NODE_ENV: '"development"',
  FIREBASE_CONFIG: `{
    apiKey: "AIzaSyBVTH4MM_gtcjiyiIicUvknrS7VGFRP9d4",
    authDomain: "realness-development.firebaseapp.com",
    databaseURL: "https://realness-development.firebaseio.com",
    projectId: "realness-development",
    storageBucket: "realness-development.appspot.com",
    messagingSenderId: "639469569733"
  }`
})
