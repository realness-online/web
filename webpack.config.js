const path = require('path')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

module.exports = {
  entry: {
    vector: path.join(__dirname, './src/workers/vector.js'),
    compression: path.join(__dirname, './src/workers/compression.js'),
    sync: path.join(__dirname, './src/workers/sync.js')
  },
  // mode: 'development',
  mode: 'production',
  output: {
    filename: '[name].worker.js',
    path: path.join(__dirname, './public')
  },
  watchOptions: {
    ignored: /node_modules|dist|\.js/g
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': path.resolve('src')
    },
    plugins: []
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
      openAnalyzer: false
    })
  ],
  optimization: {
    usedExports: true
  }
}
