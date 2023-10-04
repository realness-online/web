// svgo.config.js
module.exports = {
  multipass: true,
  full: true,
  js2svg: {
    indent: 2,
    pretty: true
  },
  plugins: [
    'removeXMLNS',
    'reusePaths',
    'removeDimensions',
    'mergePaths',
    'prefixIds',
    'convertShapeToPath',
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeUnknownsAndDefaults: true,
          removeViewBox: false,
          removeEmptyAttrs: false,
          mergePaths: true
        }
      }
    },
    {
      name: 'sortAttrs',
      params: {
        xmlnsOrder: 'alphabetical'
      }
    }
  ]
}
