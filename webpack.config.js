const { resolve } = require('path')
const { sync } = require('glob')
const CopyPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const pageEntryName = (file) => /(?<=src\/).+(?=[$.])/.exec(file)[0]

const entries = () => ({
  background: `${__dirname}/src/background/index.ts`,
  'content/login': `${__dirname}/src/content/login.ts`,
  'content/highlighter/index': `${__dirname}/src/content/highlighter/index.ts`,
  ...Object.fromEntries(sync('src/pages/**/*.ts').map((file) => [pageEntryName(file), `./${file}`]))
})

const htmlPlugins = () =>
  sync('src/pages/**/*.html').map(
    (file) =>
      new HtmlWebpackPlugin({
        template: file,
        minify: {
          collapseWhitespace: false,
          removeComments: true
        },
        inject: 'body',
        scriptLoading: 'module',
        filename: pageEntryName(file) + '.html',
        chunks: [pageEntryName(file)]
      })
  )

const makeConfig = ({ name, mode, devtool, cssLoader, dropConsole }) => ({
  mode,
  name,
  stats: 'minimal',
  devtool,
  entry: entries(),
  output: {
    path: resolve(__dirname, 'extension'),
    filename: '[name].js',
    assetModuleFilename: 'assets/images/[name][ext][query]'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          cssLoader,
          {
            loader: 'css-loader',
            options: { importLoaders: 1 }
          },
          'postcss-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: [resolve(__dirname, 'src'), 'node_modules'],
    extensions: ['.ts', '.js']
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyPlugin({
      patterns: [
        'src/manifest.json',
        { from: 'src/assets', to: 'assets' },
        { from: 'src/content/highlighter.css', to: 'content/highlighter.css' }
      ]
    }),
    ...htmlPlugins(),
    new MiniCssExtractPlugin()
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          mangle: false,
          compress: {
            defaults: false,
            drop_console: dropConsole
          },
          output: {
            comments: false,
            beautify: true,
            indent_level: 2
          }
        }
      })
    ]
  }
})

const dev = makeConfig({
  name: 'dev',
  mode: 'development',
  devtool: 'inline-source-map',
  cssLoader: 'style-loader',
  dropConsole: false
})

const prod = makeConfig({
  name: 'prod',
  mode: 'production',
  devtool: false,
  cssLoader: MiniCssExtractPlugin.loader,
  dropConsole: true
})

module.exports = [dev, prod]
