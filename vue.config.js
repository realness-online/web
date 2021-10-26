const path = require('path')
process.env.VUE_APP_VERSION = require('./package.json').version
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

module.exports = {
  parallel: require('os').cpus().length > 1,
  productionSourceMap: true,
  css: {
    sourceMap: true,
    loaderOptions: {
      stylus: {
        loader: 'stylus-resources-loader',
        import: [path.resolve('./src/style/variables.styl')]
      }
    }
  },
  pwa: {
    name: 'Realness',
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: 'src/workers/service.js',
      swDest: 'service.worker.js'
    },
    assetsVersion: '4',
    themeColor: '#151518',
    msTileColor: '#151518',
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
      description: 'Realness – A Chill Vector Space',
      scope: '/',
      orientation: 'portrait',
      background_color: '#151518',
      icons: [
        { src: '192.png', sizes: '192x192', type: 'image/png' },
        { src: '512.png', sizes: '512x512', type: 'image/png' }
      ]
    }
  },
  configureWebpack: {
    // TODO: remove when webpack 5 is supported
    module: {
      rules: [
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: 'javascript/auto'
        }
      ]
    },

    // plugins: [
    //   new BundleAnalyzerPlugin({
    //     analyzerMode: 'static',
    //     openAnalyzer: false,
    //     reportFilename: '../artifacts/vue_report.html'
    //   })
    // ],
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
