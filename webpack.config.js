const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const pth = path.resolve

module.exports = {
  context: pth(__dirname),
  entry: {
    background: pth('src/background.js'),
  },
  plugins: [
    new CopyPlugin([
      { from: pth('src/manifest.json') },
      { from: pth('src/tab-explorer.html') },
    ]),
  ],
  devtool: 'source-map',
}
