const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const pth = path.resolve
const R = require('ramda')

const cleanManifest = R.pipe(
  R.curryN(1, JSON.parse),
  R.omit(['$schema']),
  R.partialRight(JSON.stringify, [null, 2]),
)

module.exports = {
  context: pth(__dirname),
  entry: {
    background: pth('src/background.js'),
    'tab-explorer': pth('src/tab-explorer.jsx'),
  },
  module: {
    rules: [
      {
        test: /\.css/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.jsx?/,
        use: ['babel-loader'],
      },
    ],
  },
  plugins: [
    new CopyPlugin([
      {
        from: pth('src/manifest.json'),
        transform: cleanManifest,
      },
      { from: pth('src/tab-explorer.html') },
    ]),
  ],
  devtool: 'inline-source-map',
}
