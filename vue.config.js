const path = require('path')
process.env.VUE_APP_VERSION = require('./package.json').version
module.exports = {
  css: {
    loaderOptions: {
      stylus: {
        loader: 'stylus-resources-loader',
        import: [path.resolve(__dirname, 'src/style/variables.styl')]
      }
    }
  },
  pwa: {
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: 'src/service.worker.js'
    },
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
    },
    manifestOptions: {
      name: 'Realness online',
      short_name: 'Realness',
      description: 'A social network for the realness in all of us realness.online',
      start_url: '/',
      scope: '/',
      orientation: 'portrait',
      display: 'standalone',
      background_color: '#52a0d1',
      icons: [
        {
          src: '/icons/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icons/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    }
  },
  configureWebpack: {
    optimization: {
      removeAvailableModules: false,
      runtimeChunk: 'single',
      splitChunks: {
        maxSize: 350000,
        minSize: 200000
      }
    }
  }
}
