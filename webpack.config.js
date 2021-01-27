const path = require('path')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const webpack = require('webpack')

module.exports = {
  node: {
    fs: 'empty'
  },
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
      reportFilename: '../worker_report.html'
    })
  ],
  optimization: {
    usedExports: true
  }
}
