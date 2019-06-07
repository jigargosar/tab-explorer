/* eslint-env node */

const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const pth = path.resolve
const R = require('ramda')

const cleanManifest = R.pipe(
  R.curryN(1, JSON.parse),
  R.omit(['$schema']),
  R.partialRight(JSON.stringify, [null, 2]),
)

const srcPath = pth('src')
module.exports = {
  context: pth(__dirname),
  entry: {
    background: pth('src/background.js'),
    // 'tab-explorer': pth('src/tab-explorer.jsx'),
    'tab-explorer': pth('src/tab-explorer-elm.js'),
  },
  resolve: {
    extensions: ['.jsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.css/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.elm$/,
        include: [srcPath],
        use: [
          // { loader: 'elm-hot-webpack-loader' },
          {
            loader: 'elm-webpack-loader',
            options: {
              // cwd: path.join(__dirname, '../'),
              debug: true,
            },
          },
        ],
      },
      {
        test: /\.(jsx?)$/,
        include: srcPath,
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
  devtool: 'source-map',
}
