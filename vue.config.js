const path = require('path')
process.env.VUE_APP_VERSION = require('./package.json').version
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

module.exports = {
  parallel: require('os').cpus().length > 1,
  productionSourceMap: true,
  css: {
    sourceMap: true,
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
      short_name: 'Realness`',
      description: 'A vector network for the realness in all of us realness.online',
      scope: '/',
      orientation: 'portrait',
      background_color: '#52a0d1',
      icons: [
        {
          src: '/icons/logo.svg', // inside the scope!
          sizes: '192x192', // see the size in the devtools, not in editor. I've set up size 1200x1200 in Illustrator, but Chrome says it's 150x150. Also, 'sizes':'any' not work.
          type: 'image/svg+xml', // not image/svg which is still visible in web
          purpose: 'any' // not 'maskable any' as you may see there in answers.
        },
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
    plugins: [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false
      })
    ],
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
