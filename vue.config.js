
process.env.VUE_APP_VERSION = require('./package.json').version
module.exports = {
  configureWebpack:{
    optimization: {
      splitChunks: {
        maxSize: 250000
      }
    }
  }
}
