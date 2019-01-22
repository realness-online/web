process.env.VUE_APP_VERSION = require('./package.json').version
module.exports = {
  pwa: {
    themeColor: '#52a0d1',
    msTileColor: '#52a0d1',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black-translucent',
    iconPaths: {
      favicon32: 'icons/favicon-32x32.png',
      favicon16: 'icons/favicon-16x16.png',
      appleTouchIcon: 'icons/apple-touch-icon.png',
      maskIcon: 'icons/safari-pinned-tab.svg',
      msTileImage: 'icons/mstile-150x150.png'
    }
  },
  configureWebpack: {
    optimization: {
      splitChunks: {
        maxSize: 250000
      }
    }
  }
}
