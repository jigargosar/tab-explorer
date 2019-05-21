var path = require('path')
var CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  context: path.resolve(__dirname),
  entry: {
    background: path.resolve('src/background.js'),
  },
  plugins: [
    new CopyPlugin([
      { from: 'src/manifest.json' },
      { from: 'src/tab-explorer.html' },
    ]),
  ],
  devtool: 'source-map',
}
