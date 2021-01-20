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
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black-translucent',
    iconPaths: {
      appleTouchIcon: 'icons/apple-touch-icon.png'
    },
    manifestOptions: {
      short_name: 'Realness',
      description: 'realness.online – A chill vector space for the realness in all of us',
      scope: '/',
      orientation: 'portrait',
      background_color: '#52a0d1',
      icons: [
        {
          src: '/icons/logo.svg', // inside the scope!
          sizes: '192x192',
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
        openAnalyzer: false,
        reportFilename: '../javascript_report.html'
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
