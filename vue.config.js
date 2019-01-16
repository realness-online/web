module.exports = {
  configureWebpack:{
    optimization: {
      splitChunks: {
        maxSize: 250000
      }
    }
  }
}
