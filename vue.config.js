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
    name: 'Realness',
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: 'src/workers/service.worker.js'
    },
    assetsVersion: '2',
    themeColor: '#52a0d1',
    msTileColor: '#52a0d1',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black-translucent',
    iconPaths: {
      favicon32: 'favicon.ico',
      appleTouchIcon: '180.png',
      favicon16: null,
      maskIcon: null,
      msTileImage: null
    },
    manifestOptions: {
      description: 'realness.online – A chill vector space for the realness in all of us',
      scope: '/',
      orientation: 'portrait',
      background_color: '#52a0d1',
      icons: [
        { src: '192.png', sizes: '192x192', type: 'image/png' },
        { src: '512.png', sizes: '512x512', type: 'image/png' }
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
      moduleIds: 'named',
      removeAvailableModules: true,
      runtimeChunk: 'single',
      splitChunks: {
        maxSize: 350000,
        minSize: 200000
      }
    }
  }
}
