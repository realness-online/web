'use strict'
const merge = require('webpack-merge')
const prodEnv = require('./prod.env')

module.exports = merge(prodEnv, {
  NODE_ENV: '"development"',
  FIREBASE_CONFIG: `{
    apiKey: "AIzaSyDpRbQe67nfP2HTxkThxhY2Fk-ru0x2aus",
    authDomain: "littleman-8f289.firebaseapp.com",
    databaseURL: "https://littleman-8f289.firebaseio.com",
    projectId: "littleman-8f289",
    storageBucket: "littleman-8f289.appspot.com",
    messagingSenderId: "363642054727"
  }`
})
