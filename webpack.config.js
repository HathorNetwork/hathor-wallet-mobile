const path = require('path');

module.exports = {
  entry: './src/webpack-bundle/index.js',
  mode: 'production', // Use production to avoid source maps
  devtool: false, // Disable source maps completely
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
    clean: true
  },
  resolve: {
    fallback: {
      // Match your existing React Native polyfills
      path: require.resolve('path-browserify'),
      crypto: require.resolve('react-native-crypto'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process'),
      console: require.resolve('console-browserify'),
      zlib: require.resolve('browserify-zlib'),
      events: require.resolve('events'),
      url: require.resolve('url')
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new (require('webpack').ProvidePlugin)({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ]
};