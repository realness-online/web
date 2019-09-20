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
      swSrc: 'src/controller.js'
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
    }
  },
  // chainWebpack: config => {
  //   config.module
  //     .rule('web worker')
  //     .test(/\.worker\.js$/)
  //     .use('worker-loader')
  //       .loader('worker-loader')
  //       .end()
  // },
  configureWebpack: {
    optimization: {
      splitChunks: {
        maxSize: 250000
      }
    },
    // module: {
    //   rules: [{
    //     test: /\.worker\.js$/,
    //     use: {
    //       loader: 'worker-loader',
    //       options: {
    //         fallback: true,
    //         inline: false
    //       }
    //     }
    //   }]
    // }
    // optimization: {
    //   removeAvailableModules: false,
    //   runtimeChunk: 'single',
    //   splitChunks: {
    //     name: false,
    //     automaticNameDelimiter: '-',
    //     cacheGroups: {
    //       vendors: {
    //         test: /[\\/]node_modules[\\/]/,
    //         chunks: 'all',
    //         maxSize: 330000,
    //         name: false,
    //         priority: 1
    //       }
    //     }
    //   }
    // }
  }
}
