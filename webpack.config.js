/* eslint-disable no-console */
/* eslint-env node */

const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const pth = path.resolve
const R = require('ramda')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const NpmInstallPlugin = require('npm-install-webpack-plugin')

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
          { loader: 'elm-hot-webpack-loader' },
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
    new CleanWebpackPlugin(),
    new NpmInstallPlugin({
      // Use --save or --save-dev
      dev: true,
      // Install missing peerDependencies
      peerDependencies: true,
      // Reduce amount of console logging
      quiet: false,
      // npm command used inside company, yarn is not supported yet
      npm: 'npm',
    }),
    new CopyPlugin([
      {
        from: pth('src/manifest.json'),
        transform: cleanManifest,
      },
      { from: pth('src/tab-explorer.html') },
    ]),
  ],
  devtool: 'eval-source-map',
  // devtool: 'cheap-module-eval-source-map',
  // devtool: 'cheap-module-source-map',
  devServer: {
    // writeToDisk: filePath => {
    //   const parsedPath = path.parse(filePath)
    //   console.log('parsedPath', parsedPath)
    //   const isHotUpdatePath = parsedPath.name.includes('hot-update')
    //   return !isHotUpdatePath
    // },
    writeToDisk: true,
    stats: 'errors-only',
    sockPort: 8080,
    disableHostCheck: true,
    overlay: {
      warnings: true,
      errors: true,
    },
  },
}
