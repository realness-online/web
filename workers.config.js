const path = require('path')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const webpack = require('webpack')

module.exports = {
  entry: {
    vector: path.join(__dirname, './src/workers/vector.js'),
    optimize: path.join(__dirname, './src/workers/optimize.js'),
    sync: path.join(__dirname, './src/workers/sync.js')
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
      '@': path.resolve('src')
    },
    plugins: [],
    fallback: {
      path: require.resolve('path-browserify'),
      os: require.resolve('os-browserify/browser'),
      stream: require.resolve('stream-browserify'),
      fs: require.resolve('browserify-fs'),
      buffer: require.resolve('buffer-browserify')
    }
  },
  module: {
    rules: []
  },
  stats: {
    colors: true
  },
  devtool: 'source-map',
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: '../artifacts/worker_report.html'
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    })
  ],
  optimization: {
    usedExports: true
  }
}
