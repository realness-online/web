const path = require('path')
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

module.exports = {
  entry: {
    gradient: path.join(__dirname, './workers/gradient.js'),
    vector: path.join(__dirname, './workers/vector.js'),
    optimize: path.join(__dirname, './workers/optimize.js')
  },
  mode: 'production',
  output: {
    filename: '[name].worker.js',
    path: path.join(__dirname, './public')
  },
  watchOptions: {
    ignored: /node_modules/
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': path.resolve('./')
    },
    plugins: [],
    fallback: {
      https: require.resolve('https-browserify'),
      http: require.resolve('stream-http'),
      zlib: require.resolve('browserify-zlib'),
      path: require.resolve('path-browserify'),
      os: require.resolve('os-browserify/browser'),
      stream: require.resolve('stream-browserify'),
      fs: require.resolve('browserify-fs'),
      buffer: require.resolve('buffer-browserify'),
      util: require.resolve('util/'),
      assert: require.resolve('assert/'),
      url: require.resolve('url/'),
      events: require.resolve('events/'),
      querystring: require.resolve('querystring-es3')
    }
  },
  module: {
    rules: []
  },
  stats: {
    colors: true
  },
  devtool: false,
  plugins: [
    // new BundleAnalyzerPlugin({
    //   analyzerMode: 'static',
    //   openAnalyzer: false,
    //   reportFilename: '../artifacts/worker_report.html'
    // }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    })
  ],
  optimization: {
    usedExports: true,
    minimize: false,
    minimizer: [
      new TerserPlugin({
        extractComments: false
      })
    ]
  }
}
